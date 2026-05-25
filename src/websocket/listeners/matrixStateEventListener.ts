import { BaseEventListener } from "./baseEventListener";
import { COMMAND_SEND_STATE } from "../../utils/eventBus";
import { ExtendedWebSocketServer } from "../../websocket";
import { S3Service } from "../../services/s3Service";
import { ImageServiceFactory, TargetMode } from "../../services/imageService";
import { MatrixState } from "../../db/models/user";
import { WebsocketOutboundType } from "../../utils/websocket/websocketCustomEvents/websocketOutboundType";
import logger from "../../utils/logger";

export class MatrixStateEventListener extends BaseEventListener<{ uuid: string; state: MatrixState; oldState?: MatrixState }> {
    constructor(
        wss: ExtendedWebSocketServer,
        private readonly s3Service: S3Service,
        private readonly imageServiceFactory: ImageServiceFactory
    ) {
        super(wss, COMMAND_SEND_STATE);
    }

    protected async handleEvent({ uuid, state, oldState }: { uuid: string; state: MatrixState; oldState?: MatrixState }): Promise<void> {
        logger.debug(`Received state update for user ${uuid}`);

        const sent = this.wss.sendPayload(uuid, WebsocketOutboundType.STATE, state);
        if (!sent) return;

        if (state?.global?.mode === "image" && state.image?.s3_key) {
            if (oldState) {
                const isSameMode = oldState.global?.mode === state.global.mode;
                const isSameImage = oldState.image?.s3_key === state.image.s3_key;
                const isSameFit = oldState.image?.fit === state.image.fit;

                if (isSameMode && isSameImage && isSameFit) {
                    logger.debug(`Image state hasn't changed for user ${uuid}, skipping S3 fetch and binary payload.`);
                    return;
                }
            }

            try {
                logger.info(`Fetching image from S3 for user ${uuid} (Key: ${state.image.s3_key})`);
                const imageBuffer = await this.s3Service.downloadToBuffer(state.image.s3_key);
                const imageService = this.imageServiceFactory.fromBuffer(imageBuffer, state.image.s3_key);
                const fitMode = state.image.fit ?? "contain";
                const binaryFrame = await imageService.toMatrixBinaryFrame(TargetMode.ImageMode, 64, 64, fitMode);

                this.wss.sendBinary(uuid, binaryFrame);
            } catch (error) {
                logger.error(`Failed to process and send S3 image for user ${uuid}:`, error);
            }
        }
    }
}

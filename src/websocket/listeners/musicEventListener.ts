import { BaseEventListener } from "./baseEventListener";
import { MUSIC_STATE_UPDATED_EVENT } from "../../utils/eventBus";
import { ExtendedWebSocketServer } from "../../websocket";
import { ImageServiceFactory, TargetMode } from "../../services/imageService";
import { MusicState } from "../../interfaces/MusicState";
import { WebsocketOutboundType } from "../../utils/websocket/websocketCustomEvents/websocketOutboundType";
import logger from "../../utils/logger";

export class MusicEventListener extends BaseEventListener<{ uuid: string; state: MusicState }> {
    constructor(
        wss: ExtendedWebSocketServer,
        private readonly imageServiceFactory: ImageServiceFactory
    ) {
        super(wss, MUSIC_STATE_UPDATED_EVENT);
    }

    protected async handleEvent({ uuid, state }: { uuid: string; state: MusicState }): Promise<void> {
        logger.debug(`Received music update for user ${uuid}`);

        const sent = this.wss.sendPayload(uuid, WebsocketOutboundType.MUSIC_UPDATE, state);
        if (!sent) return;

        if (state.imageUrl) {
            try {
                logger.info(`Fetching cover art from URL for user ${uuid}: ${state.imageUrl}`);
                const imageService = await this.imageServiceFactory.fromUrl(state.imageUrl);
                const binaryFrame = await imageService.toMatrixBinaryFrame(TargetMode.MusicMode, 64, 64);
                this.wss.sendBinary(uuid, binaryFrame);
            } catch (error) {
                logger.error(`Failed to process and send music cover for user ${uuid}:`, error);
            }
        }
    }
}

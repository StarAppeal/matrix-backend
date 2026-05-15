import { ExtendedWebSocket } from "../interfaces/extendedWebsocket";
import { IUser, MatrixState } from "../db/models/user";
import logger from "../utils/logger";
import { WebSocket } from "ws";
import { WebsocketOutboundType } from "../utils/websocket/websocketCustomEvents/websocketOutboundType";
import { S3Service } from "./s3Service";

const DEFAULT_STATE = {
    global: {
        mode: "idle",
        brightness: 100,
    },
};

export class WebsocketClientService {
    constructor(private readonly client: ExtendedWebSocket) {}

    public updateUser(user: IUser) {
        this.client.user = user;
        logger.debug(`User ${user.uuid} updated successfully`);
    }

    public sendPayload(type: WebsocketOutboundType, payload: unknown) {
        logger.info(`Received update for user ${this.client.user.uuid}`);
        if (this.client.readyState !== WebSocket.OPEN) {
            logger.warn(`Websocket connection for user ${this.client.user.uuid} is not open. Cannot send message.`);
            return;
        }
        this.client.send(JSON.stringify({ type, payload }), {
            binary: false,
        });
    }

    public async getHydratedState(s3Service: S3Service) {
        if (!this.client.user.lastState) return DEFAULT_STATE;

        const state = JSON.parse(JSON.stringify(this.client.user.lastState)) as MatrixState;

        if (state.global?.mode === "image" && state.image?.s3_key) {
            try {
                state.image.image_url = await s3Service.getSignedDownloadUrl(state.image.s3_key, 60);
            } catch (e) {
                logger.error(`Failed to generate S3 URL for user ${this.client.user.uuid}`, e);            }
        }
        return state;
    }

    public getSettings() {
        return {
            timezone: this.client.user.timezone,
        };
    }
}

import { ExtendedWebSocket } from "../interfaces/extendedWebsocket";
import { IUser } from "../db/models/user";
import logger from "../utils/logger";
import { WebSocket } from "ws";
import { WebsocketOutboundType } from "../utils/websocket/websocketCustomEvents/websocketOutboundType";

export class WebsocketClientService {
    constructor(private readonly client: ExtendedWebSocket) {}

    public updateUser(user: IUser) {
        this.client.user = user;
        logger.debug(`User ${user.uuid} updated successfully`);
    }

    public sendPayload(type: WebsocketOutboundType, payload: unknown) {
        logger.debug(`Sending payload (${type}) to user ${this.client.user.uuid}`);

        if (this.client.readyState !== WebSocket.OPEN) {
            logger.warn(`Websocket connection for user ${this.client.user.uuid} is not open. Cannot send payload.`);
            return;
        }

        this.client.send(JSON.stringify({ type, payload }), {
            binary: false,
        });
    }

    public sendBinary(buffer: Buffer) {
        logger.info(`Sending binary for user ${this.client.user.uuid}`);

        if (this.client.readyState !== WebSocket.OPEN) {
            logger.warn(`Websocket connection for user ${this.client.user.uuid} is not open. Cannot send binary.`);
            return;
        }

        this.client.send(buffer, { binary: true });
    }

    public getSettings() {
        return {
            timezone: this.client.user.timezone,
        };
    }
}

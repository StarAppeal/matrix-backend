import { WebsocketEventType } from "./websocketEventType";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";
import { appEventBus, WEBSOCKET_SUBSCRIBE_REQUEST } from "../../eventBus";

export class SubscribeEvent extends CustomWebsocketEvent<string> {
    event = WebsocketEventType.SUBSCRIBE;

    constructor(ws: ExtendedWebSocket) {
        super(ws);
    }

    handler = async (topic: string) => {
        logger.info(`User ${this.ws.payload?.username} requested subscription to topic: ${topic}`);
        if (!this.ws.user) return;

        appEventBus.emit(WEBSOCKET_SUBSCRIBE_REQUEST, {
            uuid: this.ws.user.uuid,
            topic,
            user: this.ws.user,
        });
    };
}

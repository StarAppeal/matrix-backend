import { WebsocketEventType } from "./websocketEventType";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";
import { appEventBus, WEBSOCKET_UNSUBSCRIBE_REQUEST } from "../../eventBus";

export class UnsubscribeEvent extends CustomWebsocketEvent<string> {
    event = WebsocketEventType.UNSUBSCRIBE;

    constructor(ws: ExtendedWebSocket) {
        super(ws);
    }

    handler = async (topic: string) => {
        logger.info(`User ${this.ws.payload?.username} requested unsubscription from topic: ${topic}`);
        if (!this.ws.user) return;

        appEventBus.emit(WEBSOCKET_UNSUBSCRIBE_REQUEST, {
            uuid: this.ws.user.uuid,
            topic,
            user: this.ws.user,
        });
    };
}

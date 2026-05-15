import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";
import { appEventBus, COMMAND_SEND_STATE } from "../../eventBus";

export class GetStateEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.GET_STATE;

    handler = async () => {
        logger.debug(`User ${this.ws.payload?.username} requested state information`);

        appEventBus.emit(COMMAND_SEND_STATE, { uuid: this.ws.user.uuid });
    };
}

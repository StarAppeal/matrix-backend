import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";
import { appEventBus, COMMAND_SEND_SETTINGS } from "../../eventBus";

export class GetSettingsEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.GET_SETTINGS;

    handler = async () => {
        logger.debug(`User ${this.ws.payload?.username} requested settings`);

        appEventBus.emit(COMMAND_SEND_SETTINGS, { uuid: this.ws.user.uuid });
    };
}

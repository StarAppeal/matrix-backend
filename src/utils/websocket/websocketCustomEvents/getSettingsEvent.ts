import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";

export class GetSettingsEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.GET_SETTINGS;

    handler = async () => {
        logger.debug(`User ${this.ws.payload?.username} requested settings`);

        // Send settings back to client
        this.ws.send(
            JSON.stringify({
                type: "SETTINGS",
                payload: {
                    timezone: this.ws.user.timezone,
                },
            }),
            { binary: false }
        );
    };
}

import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";

export class GetStateEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.GET_STATE;

    handler = async () => {
        logger.debug(`User ${this.ws.payload?.username} requested state information`);

        // Send state back to client
        this.ws.send(
            JSON.stringify({
                type: "STATE",
                payload: this.ws.user.lastState,
            }),
            { binary: false }
        );
    };
}

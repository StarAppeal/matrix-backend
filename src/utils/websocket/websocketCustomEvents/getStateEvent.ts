import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";

const DEFAULT_STATE = {
    global: {
        mode: "idle",
        brightness: 100,
    },
};

export class GetStateEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.GET_STATE;

    handler = async () => {
        logger.debug(`User ${this.ws.payload?.username} requested state information`);

        const lastState = this.ws.user.lastState ? this.ws.user.lastState : DEFAULT_STATE;

        // Send state back to client
        this.ws.send(
            JSON.stringify({
                type: "STATE",
                payload: lastState,
            }),
            { binary: false }
        );
    };
}

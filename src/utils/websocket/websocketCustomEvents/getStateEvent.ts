import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";

export class GetStateEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.GET_STATE;

    handler = async () => {
        console.log("Getting state");
        const messageToSend = {
            type: "STATE",
            payload: this.ws.user.lastState,
        };
        this.ws.send(JSON.stringify(messageToSend), { binary: false });
    };
}

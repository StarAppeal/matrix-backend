import {WebsocketEventType} from "./websocketEventType";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";

export class ErrorEvent extends CustomWebsocketEvent {
    event: string = WebsocketEventType.ERROR;

    constructor(ws: ExtendedWebSocket) {
        super(ws);
    }

    handler = async (data: any) => {
        const {message, traceback} = data;
        console.warn("Error message received", message);
        console.warn("Traceback", traceback);
    }
}

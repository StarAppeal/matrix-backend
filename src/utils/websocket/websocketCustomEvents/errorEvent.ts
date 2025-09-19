import {WebsocketEventType} from "./websocketEventType";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";

interface ErrorData {
    message: string;
    traceback: string
}

export class ErrorEvent extends CustomWebsocketEvent<ErrorData> {
    event: string = WebsocketEventType.ERROR;

    constructor(ws: ExtendedWebSocket) {
        super(ws);
    }

    handler = async (data: ErrorData) => {
        console.warn("Error message received", data.message);
        console.warn("Traceback", data.traceback);
    }
}

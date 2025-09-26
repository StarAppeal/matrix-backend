import { WebsocketEventType } from "./websocketEventType";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import logger from "../../logger";

interface ErrorData {
    message: string;
    traceback: string;
}

export class ErrorEvent extends CustomWebsocketEvent<ErrorData> {
    event: string = WebsocketEventType.ERROR;

    constructor(ws: ExtendedWebSocket) {
        super(ws);
    }

    handler = async (data: ErrorData) => {
        logger.warn("Error message received", data.message);
        logger.warn("Traceback", data.traceback);
    };
}

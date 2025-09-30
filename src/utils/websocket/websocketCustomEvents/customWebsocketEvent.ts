import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";

export abstract class CustomWebsocketEvent<T = object> {
    abstract event: string;
    abstract handler: (data: T) => void | Promise<void>;
    protected ws: ExtendedWebSocket;

    public constructor(ws: ExtendedWebSocket) {
        this.ws = ws;
    }
}

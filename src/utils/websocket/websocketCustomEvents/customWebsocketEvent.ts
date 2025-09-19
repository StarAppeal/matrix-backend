import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";

export abstract class CustomWebsocketEvent<T = any> {
    abstract event: string;
    abstract handler: (data: T) => void;
    protected ws: ExtendedWebSocket;

    public constructor(ws: ExtendedWebSocket) {
        this.ws = ws;
    }

}

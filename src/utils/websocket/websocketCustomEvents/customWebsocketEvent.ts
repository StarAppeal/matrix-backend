import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";

export abstract class CustomWebsocketEvent {
    abstract event: string;
    abstract handler: (data: any) => void;
    protected ws: ExtendedWebSocket;

    public constructor(ws: ExtendedWebSocket) {
        this.ws = ws;
    }

}

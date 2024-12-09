import {ExtendedWebSocket} from "../../interfaces/extendedWebsocket";
import {ExtendedIncomingMessage} from "../../interfaces/extendedIncomingMessage";
import {Server as WebSocketServer} from "ws";
import {heartbeat} from "./websocketServerHeartbeatInterval";
import {UserService} from "../../db/services/db/UserService";

export class WebsocketServerEventHandler {
    private readonly heartbeat: () => void;

    constructor(private webSocketServer: WebSocketServer) {
        this.heartbeat = heartbeat(this.webSocketServer);
    }

    public enableConnectionEvent(
        callback: (ws: ExtendedWebSocket, request: ExtendedIncomingMessage) => void,
    ) {
        this.webSocketServer.on(
            "connection",
            async (ws: ExtendedWebSocket, request: ExtendedIncomingMessage) => {
                const user = await (await UserService.create()).getUserByUUID(request.payload.uuid);

                ws.user = user!;

                // first: map the payload from the request to the ws object (is payloed needed anymore?)
                ws.payload = request.payload;
                // second: set the isAlive flag to true
                ws.isAlive = true;

                // last: call the callback function
                callback(ws, request);
            },
        );
    }

    public enableHeartbeat(interval: number) {
        return setInterval(() => {
            this.heartbeat();
        }, interval);
    }

    public enableCloseEvent(callback: () => void) {
        this.webSocketServer.on("close", () => {
            console.log("WebSocket server closed");
            callback();
        });
    }
}

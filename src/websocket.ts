import {Server} from "http";
import {Server as WebSocketServer, WebSocket} from "ws";
import {verifyClient} from "./utils/verifyClient";
import {ExtendedWebSocket} from "./interfaces/extendedWebsocket";
import {DecodedToken} from "./interfaces/decodedToken";
import {WebsocketServerEventHandler} from "./utils/websocket/websocketServerEventHandler";
import {WebsocketEventHandler} from "./utils/websocket/websocketEventHandler";
import {UserService} from "./db/services/db/UserService";

export class ExtendedWebSocketServer {
    private readonly _wss: WebSocketServer;

    constructor(server: Server) {
        this._wss = new WebSocketServer({
            server,
            verifyClient: (info, callback) => verifyClient(info.req, callback),
        });

        this.setupWebSocket();
    }

    private get wss(): WebSocketServer {
        return this._wss;
    }

    public broadcast(message: string) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message, {binary: false});
            }
        });
    }

    public sendMessageToUser(_id: string, message: string) {
        this.wss.clients.forEach(
            (client: WebSocket & { payload?: DecodedToken }) => {
                if (
                    client.payload?._id === _id &&
                    client.readyState === WebSocket.OPEN
                ) {
                    client.send(message, {binary: false});
                }
            },
        );
    }

    public getConnectedClients(): Set<ExtendedWebSocket> {
        return this.wss.clients as Set<ExtendedWebSocket>;
    }

    private setupWebSocket() {
        const serverEventHandler = new WebsocketServerEventHandler(this.wss);
        serverEventHandler.enableConnectionEvent((ws) => {
            const socketEventHandler = new WebsocketEventHandler(ws);

            console.log("WebSocket client connected");

            socketEventHandler.enableErrorEvent();
            socketEventHandler.enablePongEvent();
            socketEventHandler.enableMessageEvent();

            const updateUserInterval = setInterval(async () => {
                console.log("Updating user")
                const userService = await UserService.create();
                const user = await userService.getUserByUUID(ws.payload._id);
                console.log(user);
                if (user) {
                    ws.user = user;
                }
            }, 15000);
            socketEventHandler.enableDisconnectEvent(() => {
                clearInterval(updateUserInterval);
                console.log("stopped updating user");
            });
        });

        const interval = serverEventHandler.enableHeartbeat(30000);
        serverEventHandler.enableCloseEvent(() => {
            clearInterval(interval);
        });
    }
}

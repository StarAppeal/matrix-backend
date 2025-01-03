import {Server} from "http";
import {Server as WebSocketServer, WebSocket} from "ws";
import {verifyClient} from "./utils/verifyClient";
import {ExtendedWebSocket} from "./interfaces/extendedWebsocket";
import {DecodedToken} from "./interfaces/decodedToken";
import {WebsocketServerEventHandler} from "./utils/websocket/websocketServerEventHandler";
import {WebsocketEventHandler} from "./utils/websocket/websocketEventHandler";
import {getEventListeners} from "./utils/websocket/websocketCustomEvents/websocketEventUtils";
import {WebsocketEventType} from "./utils/websocket/websocketCustomEvents/websocketEventType";

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

    public sendMessageToUser(uuid: string, message: string) {
        this.wss.clients.forEach(
            (client: WebSocket & { payload?: DecodedToken }) => {
                if (
                    client.payload?.uuid === uuid &&
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

            // Register custom events
            getEventListeners(ws).forEach(socketEventHandler.registerCustomEvent, socketEventHandler);

            socketEventHandler.enableDisconnectEvent(() => {
                console.log("User disconnected");
            });

            // send initial state and settings
            // think about emitting the data needed directly to the event Handler
            ws.emit(WebsocketEventType.GET_STATE, {});
            ws.emit(WebsocketEventType.GET_SETTINGS, {});

            // initiate update user event
            ws.emit(WebsocketEventType.UPDATE_USER, {});

            const mode = ws.user.lastState?.global.mode;
            if (mode === "clock" && !ws.asyncUpdates) {
                ws.emit(WebsocketEventType.GET_WEATHER_UPDATES, {})
            }

            if (mode === "music" && !ws.asyncUpdates) {
                ws.emit(WebsocketEventType.GET_SPOTIFY_UPDATES, {})
            }
        });

        const interval = serverEventHandler.enableHeartbeat(30000);
        serverEventHandler.enableCloseEvent(() => {
            clearInterval(interval);
        });
    }
}

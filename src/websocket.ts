import {Server} from "http";
import {Server as WebSocketServer, WebSocket} from "ws";
import {verifyClient} from "./utils/verifyClient";
import {ExtendedWebSocket} from "./interfaces/extendedWebsocket";
import {DecodedToken} from "./interfaces/decodedToken";
import {WebsocketServerEventHandler} from "./utils/websocket/websocketServerEventHandler";
import {WebsocketEventHandler} from "./utils/websocket/websocketEventHandler";
import {WebsocketEventType} from "./utils/websocket/websocketCustomEvents/websocketEventType";
import {UserService} from "./db/services/db/UserService";
import {SpotifyTokenService} from "./db/services/spotifyTokenService";

export class ExtendedWebSocketServer {
    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;
    private readonly spotifyTokenService: SpotifyTokenService;

    constructor(server: Server, userService: UserService, spotifyTokenService: SpotifyTokenService) {
        this._wss = new WebSocketServer({
            server,
            verifyClient: (info, callback) => verifyClient(info.req, callback),
        });

        this.userService = userService;
        this.spotifyTokenService = spotifyTokenService;

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
        const serverEventHandler = new WebsocketServerEventHandler(this.wss, this.userService);
        serverEventHandler.enableConnectionEvent((ws) => {
            const socketEventHandler = new WebsocketEventHandler(ws, this.userService, this.spotifyTokenService);

            console.log("WebSocket client connected");

            socketEventHandler.enableErrorEvent();
            socketEventHandler.enablePongEvent();
            socketEventHandler.enableMessageEvent();

            // Register custom events
            socketEventHandler.registerCustomEvents();

            socketEventHandler.enableDisconnectEvent(() => {
                console.log("User disconnected");
            });

            // send initial state and settings
            // think about emitting the data needed directly to the event Handler
            ws.emit(WebsocketEventType.GET_SETTINGS, {});
            ws.emit(WebsocketEventType.GET_STATE, {});

            // initiate update user event
            ws.emit(WebsocketEventType.UPDATE_USER, {});

            const mode = ws.user.lastState?.global.mode;
            if (mode === "clock") {
                ws.emit(WebsocketEventType.GET_WEATHER_UPDATES, {})
            }

            if (mode === "music") {
                ws.emit(WebsocketEventType.GET_SPOTIFY_UPDATES, {})
            }
        });

        const interval = serverEventHandler.enableHeartbeat(30000);
        serverEventHandler.enableCloseEvent(() => {
            clearInterval(interval);
        });
    }
}

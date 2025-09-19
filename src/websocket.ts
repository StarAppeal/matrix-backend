import { Server } from "http";
import { Server as WebSocketServer, WebSocket } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { WebsocketServerEventHandler } from "./utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "./utils/websocket/websocketEventHandler";
import { WebsocketEventType } from "./utils/websocket/websocketCustomEvents/websocketEventType";
import { UserService } from "./db/services/db/UserService";
import { SpotifyTokenService } from "./db/services/spotifyTokenService";
import { appEventBus, USER_UPDATED_EVENT } from "./utils/eventBus";
import { IUser } from "./db/models/user";

export class ExtendedWebSocketServer {
    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;
    private readonly spotifyTokenService: SpotifyTokenService;

    constructor(server: Server, userService: UserService, spotifyTokenService: SpotifyTokenService) {
        this.userService = userService;
        this.spotifyTokenService = spotifyTokenService;

        this._wss = new WebSocketServer({
            server,
            verifyClient: (info, callback) => verifyClient(info.req, callback),
        });

        this._setupConnectionHandling();
        this._listenForAppEvents();
    }

    public broadcast(message: string): void {
        this.getConnectedClients().forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message, { binary: false });
            }
        });
    }

    public sendMessageToUser(uuid: string, message: string): void {
        const client = this._findClientByUUID(uuid);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(message, { binary: false });
        }
    }

    public getConnectedClients(): Set<ExtendedWebSocket> {
        return this._wss.clients as Set<ExtendedWebSocket>;
    }

    private _setupConnectionHandling(): void {
        const serverEventHandler = new WebsocketServerEventHandler(this._wss, this.userService);

        serverEventHandler.enableConnectionEvent((ws) => {
            this._onNewClientReady(ws);
        });

        const interval = serverEventHandler.enableHeartbeat(30000);
        serverEventHandler.enableCloseEvent(() => {
            clearInterval(interval);
        });
    }

    private _onNewClientReady(ws: ExtendedWebSocket): void {
        console.log("WebSocket client connected and authenticated");

        const socketEventHandler = new WebsocketEventHandler(ws, this.userService, this.spotifyTokenService);

        socketEventHandler.enableErrorEvent();
        socketEventHandler.enablePongEvent();
        socketEventHandler.enableMessageEvent();
        socketEventHandler.registerCustomEvents();
        socketEventHandler.enableDisconnectEvent(() => {
            console.log("User disconnected");
        });

        // send initial state and settings
        ws.emit(WebsocketEventType.GET_SETTINGS, {});
        ws.emit(WebsocketEventType.GET_STATE, {});

        const mode = ws.user.lastState?.global.mode;
        if (mode === "clock") {
            ws.emit(WebsocketEventType.GET_WEATHER_UPDATES, {});
        }
        if (mode === "music") {
            ws.emit(WebsocketEventType.GET_SPOTIFY_UPDATES, {});
        }
    }

    private _listenForAppEvents(): void {
        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            console.log(`Received update for user ${user.uuid}`);
            const client = this._findClientByUUID(user.uuid);
            if (client) {
                console.log(`Pushing update to user ${user.uuid}`);
                client.emit(WebsocketEventType.UPDATE_USER_SINGLE, user);
            }
        });
    }

    private _findClientByUUID(uuid: string): ExtendedWebSocket | undefined {
        for (const client of this.getConnectedClients()) {
            if (client.payload?.uuid === uuid) {
                return client;
            }
        }
        return undefined;
    }
}
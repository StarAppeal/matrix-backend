import { Server } from "http";
import { Server as WebSocketServer, WebSocket } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { WebsocketServerEventHandler } from "./utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "./utils/websocket/websocketEventHandler";
import { WebsocketEventType } from "./utils/websocket/websocketCustomEvents/websocketEventType";
import {
    appEventBus,
    SPOTIFY_STATE_UPDATED_EVENT,
    USER_UPDATED_EVENT,
    WEATHER_STATE_UPDATED_EVENT,
} from "./utils/eventBus";
import { IUser } from "./db/models/user";
import { SpotifyPollingService } from "./services/spotifyPollingService";
import { UserService } from "./services/db/UserService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import logger from "./utils/logger";

export class ExtendedWebSocketServer {
    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;
    private readonly spotifyPollingService: SpotifyPollingService;
    private readonly weatherPollingService: WeatherPollingService;

    constructor(
        server: Server,
        userService: UserService,
        spotifyPollingService: SpotifyPollingService,
        weatherPollingService: WeatherPollingService,
        jwtAuthenticator: JwtAuthenticator
    ) {
        this.userService = userService;
        this.spotifyPollingService = spotifyPollingService;
        this.weatherPollingService = weatherPollingService;

        this._wss = new WebSocketServer({
            server,
            verifyClient: (info, callback) => verifyClient(info.req, jwtAuthenticator, callback),
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
        logger.info("WebSocket client connected and authenticated");

        const socketEventHandler = new WebsocketEventHandler(
            ws,
            this.spotifyPollingService,
            this.weatherPollingService
        );

        socketEventHandler.enableErrorEvent();
        socketEventHandler.enablePongEvent();
        socketEventHandler.enableMessageEvent();
        socketEventHandler.registerCustomEvents();
        socketEventHandler.enableDisconnectEvent(() => {
            logger.info("User disconnected");
        });

        // send initial state and settings
        ws.emit(WebsocketEventType.GET_SETTINGS, {});
        ws.emit(WebsocketEventType.GET_STATE, {});
    }

    private _listenForAppEvents(): void {
        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            logger.debug(`Received update for user ${user.uuid}`);
            const client = this._findClientByUUID(user.uuid);
            if (client) {
                logger.debug(`Pushing update to user ${user.uuid}`);
                client.emit(WebsocketEventType.UPDATE_USER_SINGLE, user);
            }
        });

        appEventBus.on(SPOTIFY_STATE_UPDATED_EVENT, ({ uuid, state }) => {
            const client = this._findClientByUUID(uuid);
            logger.debug(`Received update for user ${uuid}`);
            if (client) {
                client.send(
                    JSON.stringify({
                        type: "SPOTIFY_UPDATE",
                        payload: state,
                    }),
                    { binary: false }
                );
            }
        });

        appEventBus.on(WEATHER_STATE_UPDATED_EVENT, ({ weatherData, subscribers }) => {
            for (const uuid of subscribers) {
                const client = this._findClientByUUID(uuid);
                if (client) {
                    client.send(
                        JSON.stringify({
                            type: "WEATHER_UPDATE",
                            payload: weatherData,
                        }),
                        { binary: false }
                    );
                }
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

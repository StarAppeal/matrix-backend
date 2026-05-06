import { Server } from "http";
import { Server as WebSocketServer, WebSocket } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { WebsocketServerEventHandler } from "./utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "./utils/websocket/websocketEventHandler";
import { WebsocketEventType } from "./utils/websocket/websocketCustomEvents/websocketEventType";
import {
    appEventBus,
    MUSIC_STATE_UPDATED_EVENT,
    TAMAGOTCHI_STATE_UPDATED_EVENT,
    USER_UPDATED_EVENT,
    WEATHER_STATE_UPDATED_EVENT,
} from "./utils/eventBus";
import { WebsocketOutboundType } from "./utils/websocket/websocketCustomEvents/websocketOutboundType";
import { IUser } from "./db/models/user";
import { MusicPollingService } from "./services/musicPollingService";
import { UserService } from "./services/db/UserService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import logger from "./utils/logger";
import { TamagotchiPollingService } from "./services/tamagotchiPollingService";

export class ExtendedWebSocketServer {
    private readonly uuidClientMap = new Map<string, ExtendedWebSocket>();

    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;
    private readonly musicPollingService: MusicPollingService;
    private readonly weatherPollingService: WeatherPollingService;
    private readonly tamagotchiPollingService: TamagotchiPollingService;

    constructor(
        server: Server,
        userService: UserService,
        musicPollingService: MusicPollingService,
        weatherPollingService: WeatherPollingService,
        tamagotchiPollingService: TamagotchiPollingService,
        jwtAuthenticator: JwtAuthenticator
    ) {
        this.userService = userService;
        this.musicPollingService = musicPollingService;
        this.weatherPollingService = weatherPollingService;
        this.tamagotchiPollingService = tamagotchiPollingService;

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

    public closeServer() {
        this._wss.close();
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
        if (ws.payload?.uuid) {
            this.uuidClientMap.set(ws.payload.uuid, ws);
        }

        logger.info("WebSocket client connected and authenticated");

        const socketEventHandler = new WebsocketEventHandler(
            ws,
            this.musicPollingService,
            this.weatherPollingService,
            this.tamagotchiPollingService
        );

        socketEventHandler.enableErrorEvent();
        socketEventHandler.enablePongEvent();
        socketEventHandler.enableMessageEvent();
        socketEventHandler.registerCustomEvents();
        socketEventHandler.enableDisconnectEvent(() => {
            this.uuidClientMap.delete(ws.payload?.uuid);

            if (ws.user?.location && ws.user.location?.lat && ws.user.location?.lon) {
                this.weatherPollingService.unsubscribeUser(ws.user.uuid, ws.user.location.lat, ws.user.location.lon);
            }

            this.musicPollingService.stopPollingForUser(ws.user.uuid);
            this.tamagotchiPollingService.stopPollingForUser(ws.user.uuid);

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
                client.user = user;
                logger.debug(`User ${user.uuid} updated successfully`);
            }
        });

        appEventBus.on(MUSIC_STATE_UPDATED_EVENT, ({ uuid, state }) => {
            const client = this._findClientByUUID(uuid);
            logger.debug(`Received update for user ${uuid}`);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: WebsocketOutboundType.MUSIC_UPDATE, payload: state }), { binary: false });
            }
        });

        appEventBus.on(WEATHER_STATE_UPDATED_EVENT, ({ weatherData, subscribers }) => {
            for (const uuid of subscribers) {
                const client = this._findClientByUUID(uuid);
                if (client && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: WebsocketOutboundType.WEATHER_UPDATE, payload: weatherData }), { binary: false });
                }
            }
        });

        appEventBus.on(TAMAGOTCHI_STATE_UPDATED_EVENT, ({ uuid, payload }) => {
            const client = this._findClientByUUID(uuid);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: WebsocketOutboundType.TAMAGOTCHI_UPDATE, payload: payload }), { binary: false });
            }
        });
    }

    private _findClientByUUID(uuid: string): ExtendedWebSocket | undefined {
        return this.uuidClientMap.get(uuid);
    }
}

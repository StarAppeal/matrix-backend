import { Server } from "http";
import { Server as WebSocketServer, WebSocket } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { WebsocketServerEventHandler } from "./utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "./utils/websocket/websocketEventHandler";
import {
    appEventBus,
    COMMAND_SEND_SETTINGS,
    COMMAND_SEND_STATE,
    MUSIC_STATE_UPDATED_EVENT,
    TAMAGOTCHI_STATE_UPDATED_EVENT,
    USER_UPDATED_EVENT,
    WEATHER_STATE_UPDATED_EVENT,
} from "./utils/eventBus";
import { WebsocketOutboundType } from "./utils/websocket/websocketCustomEvents/websocketOutboundType";
import { IUser, MatrixState } from "./db/models/user";
import { MusicPollingService } from "./services/musicPollingService";
import { UserService } from "./services/db/UserService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import logger from "./utils/logger";
import { TamagotchiPollingService } from "./services/tamagotchiPollingService";
import { WebsocketClientService } from "./services/websocketClientService";
import { MusicState } from "./interfaces/MusicState";
import { ImageServiceFactory, TargetMode } from "./services/imageService";
import { S3Service } from "./services/s3Service";

export class ExtendedWebSocketServer {
    private readonly uuidClientMap = new Map<string, ExtendedWebSocket>();

    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;
    private readonly musicPollingService: MusicPollingService;
    private readonly weatherPollingService: WeatherPollingService;
    private readonly tamagotchiPollingService: TamagotchiPollingService;
    private readonly s3Service: S3Service;
    private readonly imageServiceFactory: ImageServiceFactory;

    constructor(
        server: Server,
        userService: UserService,
        musicPollingService: MusicPollingService,
        weatherPollingService: WeatherPollingService,
        tamagotchiPollingService: TamagotchiPollingService,
        jwtAuthenticator: JwtAuthenticator,
        s3Service: S3Service,
        imageServiceFactory: ImageServiceFactory
    ) {
        this.userService = userService;
        this.musicPollingService = musicPollingService;
        this.weatherPollingService = weatherPollingService;
        this.tamagotchiPollingService = tamagotchiPollingService;
        this.s3Service = s3Service;
        this.imageServiceFactory = imageServiceFactory;

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
        const uuid = ws.payload?.uuid;

        if (uuid) {
            const existingClient = this.uuidClientMap.get(uuid);

            if (existingClient && existingClient.readyState === WebSocket.OPEN) {
                logger.warn(`User ${uuid} connected again. Closing old zombie connection.`);
                existingClient.close(1000, "New connection established");
            }

            this.uuidClientMap.set(uuid, ws);
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
            const uuid = ws.payload?.uuid;
            if (!uuid) return;

            const mappedClient = this.uuidClientMap.get(uuid);

            if (mappedClient === ws) {
                this.uuidClientMap.delete(uuid);

                if (ws.user?.location && ws.user.location?.lat && ws.user.location?.lon) {
                    this.weatherPollingService.unsubscribeUser(
                        ws.user.uuid,
                        ws.user.location.lat,
                        ws.user.location.lon
                    );
                }

                this.musicPollingService.stopPollingForUser(ws.user.uuid);
                this.tamagotchiPollingService.stopPollingForUser(ws.user.uuid);

                logger.info("User disconnected");
            } else {
                logger.debug(`Ignored disconnect for zombie client of user ${uuid}`);
            }
        });

        // send initial state and settings
        appEventBus.emit(COMMAND_SEND_STATE, { uuid: ws.user.uuid, state: ws.user.lastState });
        appEventBus.emit(COMMAND_SEND_SETTINGS, { uuid: ws.user.uuid });
    }

    private _listenForAppEvents(): void {
        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            logger.debug(`Received update for user ${user.uuid}`);
            this._withClientService(user.uuid, (clientService) => clientService.updateUser(user));
        });

        appEventBus.on(MUSIC_STATE_UPDATED_EVENT, async ({ uuid, state }: { uuid: string; state: MusicState }) => {
            logger.debug(`Received update for user ${uuid}`);

            this._withClientService(uuid, async (service) => {
                service.sendPayload(WebsocketOutboundType.MUSIC_UPDATE, state);

                if (!state.imageUrl) return;

                const imageService = await this.imageServiceFactory.fromUrl(state.imageUrl);
                const binaryFrame = await imageService.toMatrixBinaryFrame(TargetMode.MusicMode, 64, 64);

                service.sendBinary(binaryFrame);
            });
        });

        appEventBus.on(WEATHER_STATE_UPDATED_EVENT, ({ weatherData, subscribers }) => {
            for (const uuid of subscribers) {
                logger.debug(`Received update for user ${uuid}`);
                this._withClientService(uuid, (service) =>
                    service.sendPayload(WebsocketOutboundType.WEATHER_UPDATE, weatherData)
                );
            }
        });

        appEventBus.on(TAMAGOTCHI_STATE_UPDATED_EVENT, ({ uuid, payload }) => {
            logger.debug(`Received update for user ${uuid}`);
            this._withClientService(uuid, (service) =>
                service.sendPayload(WebsocketOutboundType.TAMAGOTCHI_UPDATE, payload)
            );
        });

        appEventBus.on(COMMAND_SEND_STATE, async ({ uuid, state }: { uuid: string; state: MatrixState }) => {
            logger.debug(`Received state update for user ${uuid}`);

            this._withClientService(uuid, async (service) => {
                service.sendPayload(WebsocketOutboundType.STATE, state);

                if (state?.global?.mode === "image" && state.image?.s3_key) {
                    logger.info(`Fetching image from S3 for user ${uuid} (Key: ${state.image.s3_key})`);

                    const imageBuffer = await this.s3Service.downloadToBuffer(state.image.s3_key);

                    const imageService = this.imageServiceFactory.fromBuffer(imageBuffer);
                    const fitMode = state.image.fit ?? "contain";

                    const binaryFrame = await imageService.toMatrixBinaryFrame(TargetMode.ImageMode, 64, 64, fitMode);

                    service.sendBinary(binaryFrame);
                }
            });
        });

        appEventBus.on(COMMAND_SEND_SETTINGS, ({ uuid }) => {
            logger.debug(`Received update for user ${uuid}`);
            this._withClientService(uuid, (service) => {
                const payload = service.getSettings();

                service.sendPayload(WebsocketOutboundType.SETTINGS, payload);
            });
        });
    }

    private _findClientByUUID(uuid: string): ExtendedWebSocket | undefined {
        return this.uuidClientMap.get(uuid);
    }

    private _withClientService(uuid: string, action: (service: WebsocketClientService) => void | Promise<void>): void {
        const client = this._findClientByUUID(uuid);
        if (client && client.readyState === WebSocket.OPEN) {
            action(new WebsocketClientService(client));
        }
    }
}

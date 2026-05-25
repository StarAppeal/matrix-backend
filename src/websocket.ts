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
    WEBSOCKET_CLIENT_DISCONNECTED,
} from "./utils/eventBus";
import { WebsocketOutboundType } from "./utils/websocket/websocketCustomEvents/websocketOutboundType";
import { IUser } from "./db/models/user";
import { UserService } from "./services/db/UserService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import logger from "./utils/logger";

export class ExtendedWebSocketServer {
    private readonly uuidClientMap = new Map<string, ExtendedWebSocket>();

    private readonly _wss: WebSocketServer;
    private readonly userService: UserService;

    constructor(
        server: Server,
        userService: UserService,
        jwtAuthenticator: JwtAuthenticator
    ) {
        this.userService = userService;

        this._wss = new WebSocketServer({
            server,
            verifyClient: (info, callback) => verifyClient(info.req, jwtAuthenticator, callback),
        });

        this._setupConnectionHandling();
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

    public sendPayload(uuid: string, type: WebsocketOutboundType, payload: unknown): boolean {
        const client = this._findClientByUUID(uuid);
        if (client && client.readyState === WebSocket.OPEN) {
            logger.debug(`Sending payload (${type}) to user ${uuid}`);
            client.send(JSON.stringify({ type, payload }), { binary: false });
            return true;
        }
        logger.warn(`Websocket connection for user ${uuid} is not open. Cannot send payload.`);
        return false;
    }

    public sendBinary(uuid: string, buffer: Buffer): boolean {
        const client = this._findClientByUUID(uuid);
        if (client && client.readyState === WebSocket.OPEN) {
            logger.info(`Sending binary frame to user ${uuid}`);
            client.send(buffer, { binary: true });
            return true;
        }
        logger.warn(`Websocket connection for user ${uuid} is not open. Cannot send binary.`);
        return false;
    }

    public getUser(uuid: string): IUser | undefined {
        return this._findClientByUUID(uuid)?.user;
    }

    public updateUserInMap(user: IUser): void {
        const client = this._findClientByUUID(user.uuid);
        if (client) {
            client.user = user;
            logger.debug(`Updated user ${user.uuid} data on active socket connection`);
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

        const socketEventHandler = new WebsocketEventHandler(ws);

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

                if (ws.user) {
                    appEventBus.emit(WEBSOCKET_CLIENT_DISCONNECTED, { uuid: ws.user.uuid, user: ws.user });
                }

                logger.info("User disconnected");
            } else {
                logger.debug(`Ignored disconnect for zombie client of user ${uuid}`);
            }
        });

        // send initial state and settings
        appEventBus.emit(COMMAND_SEND_STATE, { uuid: ws.user.uuid, state: ws.user.lastState });
        appEventBus.emit(COMMAND_SEND_SETTINGS, { uuid: ws.user.uuid });
    }

    private _findClientByUUID(uuid: string): ExtendedWebSocket | undefined {
        return this.uuidClientMap.get(uuid);
    }
}

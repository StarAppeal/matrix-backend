import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { Server } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { ExtendedWebSocketServer } from "../src/websocket";
import { WebsocketServerEventHandler } from "../src/utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "../src/utils/websocket/websocketEventHandler";
import { getEventListeners } from "../src/utils/websocket/websocketCustomEvents/websocketEventUtils";
import { createMockJwtAuthenticator, createMockUserService } from "./helpers/testSetup";
import { UserService } from "../src/services/db/UserService";
import {
    appEventBus,
    COMMAND_SEND_STATE,
    COMMAND_SEND_SETTINGS,
    WEBSOCKET_CLIENT_DISCONNECTED,
} from "../src/utils/eventBus";
import { WebsocketOutboundType } from "../src/utils/websocket/websocketCustomEvents/websocketOutboundType";

let mockWssInstance: Mocked<WebSocketServer>;
let mockServerEventHandler: Mocked<WebsocketServerEventHandler>;

vi.mock("../src/utils/eventBus", () => ({
    appEventBus: {
        emit: vi.fn(),
    },
    COMMAND_SEND_STATE: "command:send-state",
    COMMAND_SEND_SETTINGS: "command:send-settings",
    WEBSOCKET_CLIENT_DISCONNECTED: "websocket:client-disconnected",
}));

vi.mock("ws", () => ({
    Server: vi.fn().mockImplementation(() => mockWssInstance),
    WebSocket: { OPEN: 1, CLOSED: 3 },
}));

vi.mock("../src/utils/verifyClient");
vi.mock("../src/utils/websocket/websocketServerEventHandler", () => ({
    WebsocketServerEventHandler: vi.fn().mockImplementation(() => mockServerEventHandler),
}));
vi.mock("../src/utils/websocket/websocketEventHandler");
vi.mock("../src/utils/websocket/websocketCustomEvents/websocketEventUtils");

describe("ExtendedWebSocketServer", () => {
    let mockHttpServer: Mocked<Server>;
    let extendedWss: ExtendedWebSocketServer;
    let mockUserService: Mocked<UserService>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockHttpServer = {} as Mocked<Server>;

        mockServerEventHandler = {
            enableConnectionEvent: vi.fn(),
            enableHeartbeat: vi.fn(),
            enableCloseEvent: vi.fn(),
        } as unknown as Mocked<WebsocketServerEventHandler>;

        mockWssInstance = {
            clients: new Set(),
            on: vi.fn(),
            close: vi.fn(),
        } as unknown as Mocked<WebSocketServer>;

        // @ts-ignore
        mockUserService = createMockUserService();

        extendedWss = new ExtendedWebSocketServer(
            mockHttpServer,
            mockUserService,
            createMockJwtAuthenticator() as any
        );
    });

    describe("Constructor and Setup", () => {
        it("should create a new WebSocket.Server", () => {
            expect(WebSocketServer).toHaveBeenCalledWith({
                server: mockHttpServer,
                verifyClient: expect.any(Function),
            });
        });

        it("should create and use a WebsocketServerEventHandler with the correct service", () => {
            expect(WebsocketServerEventHandler).toHaveBeenCalledWith(mockWssInstance, mockUserService);
        });

        it("should enable the heartbeat", () => {
            expect(mockServerEventHandler.enableHeartbeat).toHaveBeenCalledWith(30000);
        });

        it("should register a connection handler", () => {
            expect(mockServerEventHandler.enableConnectionEvent).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe("broadcast", () => {
        it("should send a message to all connected clients that are OPEN", () => {
            const client1 = { readyState: WebSocket.OPEN, send: vi.fn() };
            const client2 = { readyState: WebSocket.CLOSED, send: vi.fn() };
            mockWssInstance.clients.add(client1 as any).add(client2 as any);
            extendedWss.broadcast("hello");
            expect(client1.send).toHaveBeenCalledWith("hello", { binary: false });
            expect(client2.send).not.toHaveBeenCalled();
        });
    });

    describe("sendMessageToUser", () => {
        it("should send a message to a specific user by their UUID", () => {
            const client1 = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-1" }, user: { uuid: "uuid-1" }, send: vi.fn(), emit: vi.fn() };
            const client2 = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-2" }, user: { uuid: "uuid-2" }, send: vi.fn(), emit: vi.fn() };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(client1 as any, {} as any);
            connectionHandler(client2 as any, {} as any);
            extendedWss.sendMessageToUser("uuid-1", "private");
            expect(client1.send).toHaveBeenCalledWith("private", { binary: false });
            expect(client2.send).not.toHaveBeenCalled();
        });
    });

    describe("sendPayload", () => {
        it("should send serialized JSON payload to open client", () => {
            const client = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-1" }, user: { uuid: "uuid-1" }, send: vi.fn(), emit: vi.fn() };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(client as any, {} as any);

            const result = extendedWss.sendPayload("uuid-1", WebsocketOutboundType.STATE, { brightness: 10 });
            expect(result).toBe(true);
            expect(client.send).toHaveBeenCalledWith(
                JSON.stringify({ type: WebsocketOutboundType.STATE, payload: { brightness: 10 } }),
                { binary: false }
            );
        });

        it("should return false if client not connected", () => {
            const result = extendedWss.sendPayload("unknown-uuid", WebsocketOutboundType.STATE, {});
            expect(result).toBe(false);
        });
    });

    describe("sendBinary", () => {
        it("should send binary buffer to open client", () => {
            const client = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-1" }, user: { uuid: "uuid-1" }, send: vi.fn(), emit: vi.fn() };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(client as any, {} as any);

            const buffer = Buffer.from([1, 2, 3]);
            const result = extendedWss.sendBinary("uuid-1", buffer);
            expect(result).toBe(true);
            expect(client.send).toHaveBeenCalledWith(buffer, { binary: true });
        });

        it("should return false if client not connected", () => {
            const result = extendedWss.sendBinary("unknown-uuid", Buffer.from([1]));
            expect(result).toBe(false);
        });
    });

    describe("getUser & updateUserInMap", () => {
        it("should retrieve and update user data in active connection map", () => {
            const client = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-1" }, user: { uuid: "uuid-1", name: "old" }, send: vi.fn(), emit: vi.fn() };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(client as any, {} as any);

            expect(extendedWss.getUser("uuid-1")).toEqual({ uuid: "uuid-1", name: "old" });

            extendedWss.updateUserInMap({ uuid: "uuid-1", name: "new" } as any);
            expect(extendedWss.getUser("uuid-1")).toEqual({ uuid: "uuid-1", name: "new" });
        });
    });

    describe("Connection Handler Logic", () => {
        let connectionHandler: (ws: any, req: any) => void;
        let mockWsClient: any;
        let mockClientEventHandler: Mocked<WebsocketEventHandler>;

        beforeEach(() => {
            connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            mockWsClient = {
                emit: vi.fn(),
                on: vi.fn(),
                payload: { uuid: "user-123" },
                user: {
                    uuid: "user-123",
                    lastState: { global: { mode: "idle" } },
                },
            };
            mockClientEventHandler = {
                enableErrorEvent: vi.fn(),
                enablePongEvent: vi.fn(),
                enableMessageEvent: vi.fn(),
                enableDisconnectEvent: vi.fn(),
                registerCustomEvents: vi.fn(),
            } as unknown as Mocked<WebsocketEventHandler>;

            vi.mocked(WebsocketEventHandler).mockImplementation(() => mockClientEventHandler);
            vi.mocked(getEventListeners).mockReturnValue([{ event: "custom", handler: vi.fn() } as any]);
        });

        it("should create and configure a WebsocketEventHandler for new clients", () => {
            connectionHandler(mockWsClient, {});
            expect(vi.mocked(WebsocketEventHandler)).toHaveBeenCalledWith(mockWsClient);
            expect(mockClientEventHandler.enableErrorEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enablePongEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enableMessageEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enableDisconnectEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.registerCustomEvents).toHaveBeenCalled();
        });

        it("should trigger initial commands via appEventBus for the new client", () => {
            vi.mocked(appEventBus.emit).mockClear();
            connectionHandler(mockWsClient, {});

            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_STATE, { uuid: "user-123", state: { global: { mode: "idle" } } } as any);
            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_SETTINGS, { uuid: "user-123" });
        });

        it("should handle disconnect correctly and emit WEBSOCKET_CLIENT_DISCONNECTED", () => {
            mockWsClient.payload = { uuid: "user-123", username: "test" };
            mockWsClient.user = {
                uuid: "user-123",
                location: { lat: 52.5, lon: 13.4 },
            };

            connectionHandler(mockWsClient, {});

            const disconnectCallback = vi.mocked(mockClientEventHandler.enableDisconnectEvent).mock.calls[0][0];

            vi.mocked(appEventBus.emit).mockClear();
            disconnectCallback();

            expect(appEventBus.emit).toHaveBeenCalledWith(WEBSOCKET_CLIENT_DISCONNECTED, {
                uuid: "user-123",
                user: mockWsClient.user,
            });
        });

        it("should close existing zombie connection when the same user connects again", () => {
            const oldClient = {
                readyState: WebSocket.OPEN,
                close: vi.fn(),
                payload: { uuid: "zombie-user" },
                user: { uuid: "zombie-user" },
                emit: vi.fn(),
                send: vi.fn(),
            };
            const newClient = {
                readyState: WebSocket.OPEN,
                close: vi.fn(),
                payload: { uuid: "zombie-user" },
                user: { uuid: "zombie-user" },
                emit: vi.fn(),
                send: vi.fn(),
            };

            connectionHandler(oldClient, {});
            expect(oldClient.close).not.toHaveBeenCalled();

            connectionHandler(newClient, {});

            expect(oldClient.close).toHaveBeenCalledWith(1000, "New connection established");
            expect(newClient.close).not.toHaveBeenCalled();

            extendedWss.sendMessageToUser("zombie-user", "test");
            expect(newClient.send).toHaveBeenCalled();
        });

        it("should ignore disconnect events from zombie clients and NOT emit client disconnected event", () => {
            const oldClient = {
                readyState: WebSocket.OPEN,
                close: vi.fn(),
                payload: { uuid: "zombie-user" },
                user: { uuid: "zombie-user" },
                emit: vi.fn(),
            };
            const newClient = {
                readyState: WebSocket.OPEN,
                close: vi.fn(),
                payload: { uuid: "zombie-user" },
                user: { uuid: "zombie-user" },
                emit: vi.fn(),
            };

            connectionHandler(oldClient, {});
            const oldDisconnectCallback = vi.mocked(mockClientEventHandler.enableDisconnectEvent).mock.calls[0][0];

            connectionHandler(newClient, {});

            vi.mocked(appEventBus.emit).mockClear();

            oldDisconnectCallback();

            expect(appEventBus.emit).not.toHaveBeenCalledWith(WEBSOCKET_CLIENT_DISCONNECTED, expect.any(Object));
        });
    });
});

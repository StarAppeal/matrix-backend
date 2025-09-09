import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { Server } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { ExtendedWebSocketServer } from "../src/websocket";
import { WebsocketServerEventHandler } from "../src/utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "../src/utils/websocket/websocketEventHandler";
import { getEventListeners } from "../src/utils/websocket/websocketCustomEvents/websocketEventUtils";

let mockWssInstance: Mocked<WebSocketServer>;
let mockServerEventHandler: Mocked<WebsocketServerEventHandler>;

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

        extendedWss = new ExtendedWebSocketServer(mockHttpServer);
    });

    describe("Constructor and Setup", () => {
        it("should create a new WebSocket.Server", () => {
            expect(WebSocketServer).toHaveBeenCalledWith({
                server: mockHttpServer,
                verifyClient: expect.any(Function),
            });
        });

        it("should create and use a WebsocketServerEventHandler", () => {
            expect(WebsocketServerEventHandler).toHaveBeenCalledWith(mockWssInstance);
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
            const client1 = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-1" }, send: vi.fn() };
            const client2 = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-2" }, send: vi.fn() };
            mockWssInstance.clients.add(client1 as any).add(client2 as any);
            extendedWss.sendMessageToUser("uuid-1", "private");
            expect(client1.send).toHaveBeenCalledWith("private", { binary: false });
            expect(client2.send).not.toHaveBeenCalled();
        });
    });

    describe("Connection Handler Logic", () => {
        let connectionHandler: (ws: any, req: any) => void;
        let mockWsClient: any;
        let mockClientEventHandler: Mocked<WebsocketEventHandler>;

        beforeEach(() => {
            connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            mockWsClient = {
                emit: vi.fn(), on: vi.fn(), user: { lastState: { global: { mode: "idle" } } },
            };
            mockClientEventHandler = {
                enableErrorEvent: vi.fn(), enablePongEvent: vi.fn(),
                enableMessageEvent: vi.fn(), enableDisconnectEvent: vi.fn(),
                registerCustomEvent: vi.fn(),
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
            expect(mockClientEventHandler.registerCustomEvent).toHaveBeenCalled();
        });

        it("should emit initial events to the new client", () => {
            connectionHandler(mockWsClient, {});
            expect(mockWsClient.emit).toHaveBeenCalledWith("GET_STATE", {});
            expect(mockWsClient.emit).toHaveBeenCalledWith("GET_SETTINGS", {});
        });

        it("should emit GET_SPOTIFY_UPDATES if last state was 'music'", () => {
            mockWsClient.user.lastState.global.mode = "music";
            connectionHandler(mockWsClient, {});
            expect(mockWsClient.emit).toHaveBeenCalledWith("GET_SPOTIFY_UPDATES", {});
        });
    });
});
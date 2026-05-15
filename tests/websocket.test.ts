import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { Server } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { ExtendedWebSocketServer } from "../src/websocket";
import { WebsocketServerEventHandler } from "../src/utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "../src/utils/websocket/websocketEventHandler";
import { getEventListeners } from "../src/utils/websocket/websocketCustomEvents/websocketEventUtils";
import { createMockJwtAuthenticator, createMockUserService } from "./helpers/testSetup";
import { UserService } from "../src/services/db/UserService";
import { MusicPollingService } from "../src/services/musicPollingService";
import {
    appEventBus,
    USER_UPDATED_EVENT,
    MUSIC_STATE_UPDATED_EVENT,
    WEATHER_STATE_UPDATED_EVENT,
    COMMAND_SEND_STATE,
    COMMAND_SEND_SETTINGS,
} from "../src/utils/eventBus";
import { WeatherPollingService } from "../src/services/weatherPollingService";
import { TamagotchiPollingService } from "../src/services/tamagotchiPollingService";
import { S3Service } from "../src/services/s3Service";

let mockWssInstance: Mocked<WebSocketServer>;
let mockServerEventHandler: Mocked<WebsocketServerEventHandler>;

const eventBusListeners = new Map<string, (...args: any[]) => void>();

vi.mock("../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn((event, listener) => {
            eventBusListeners.set(event, listener);
        }),
        emit: vi.fn(),
    },
    USER_UPDATED_EVENT: "user:updated",
    MUSIC_STATE_UPDATED_EVENT: "music:state-updated",
    WEATHER_STATE_UPDATED_EVENT: "weather-state:updated",
    TAMAGOTCHI_STATE_UPDATED_EVENT: "tamagotchi-state:updated",
    COMMAND_SEND_STATE: "command:send-state",
    COMMAND_SEND_SETTINGS: "command:send-settings",
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
    let mockMusicPollingService: Mocked<MusicPollingService>;
    let mockWeatherPollingService: Mocked<WeatherPollingService>;
    let mockTamagotchiPollingService: Mocked<TamagotchiPollingService>;
    let mockS3Service: Mocked<S3Service>;

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

        mockMusicPollingService = {
            startPollingForUser: vi.fn(),
            stopPollingForUser: vi.fn(),
        } as unknown as Mocked<MusicPollingService>;

        mockWeatherPollingService = {
            subscribeUser: vi.fn(),
            unsubscribeUser: vi.fn(),
        } as unknown as Mocked<WeatherPollingService>;

        mockTamagotchiPollingService = {
            startPollingForUser: vi.fn(),
            stopPollingForUser: vi.fn(),
        } as unknown as Mocked<TamagotchiPollingService>;

        mockS3Service = {
            getSignedDownloadUrl: vi.fn(),
        } as unknown as Mocked<S3Service>;

        mockUserService = createMockUserService();

        extendedWss = new ExtendedWebSocketServer(
            mockHttpServer,
            mockUserService,
            mockMusicPollingService,
            mockWeatherPollingService,
            mockTamagotchiPollingService,
            mockS3Service,
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
            const client2 = { readyState: WebSocket.OPEN, payload: { uuid: "uuid-2" },user: { uuid: "uuid-2" }, send: vi.fn(), emit: vi.fn() };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(client1 as any, {} as any);
            connectionHandler(client2 as any, {} as any);
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
            expect(vi.mocked(WebsocketEventHandler)).toHaveBeenCalledWith(
                mockWsClient,
                mockMusicPollingService,
                mockWeatherPollingService,
                mockTamagotchiPollingService
            );
            expect(mockClientEventHandler.enableErrorEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enablePongEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enableMessageEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.enableDisconnectEvent).toHaveBeenCalled();
            expect(mockClientEventHandler.registerCustomEvents).toHaveBeenCalled();
        });

        it("should trigger initial commands via appEventBus for the new client", () => {
            vi.mocked(appEventBus.emit).mockClear();
            connectionHandler(mockWsClient, {});

            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_STATE, { uuid: "user-123" });
            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_SETTINGS, { uuid: "user-123" });
        });

        it("should handle disconnect correctly and unsubscribe from polling services", () => {
            mockWsClient.payload = { uuid: "user-123", username: "test" };
            mockWsClient.user = {
                uuid: "user-123",
                location: { lat: 52.5, lon: 13.4 },
            };

            connectionHandler(mockWsClient, {});

            const disconnectCallback = vi.mocked(mockClientEventHandler.enableDisconnectEvent).mock.calls[0][0];

            disconnectCallback();

            expect(mockWeatherPollingService.unsubscribeUser).toHaveBeenCalledWith("user-123", 52.5, 13.4);
            expect(mockMusicPollingService.stopPollingForUser).toHaveBeenCalledWith("user-123");
        });
    });

    describe("_listenForAppEvents", () => {
        let mockClient: any;

        beforeEach(() => {
            mockClient = {
                readyState: WebSocket.OPEN,
                payload: { uuid: "user-123" },
                user: { uuid: "user-123" },
                send: vi.fn(),
                emit: vi.fn(),
            };
            const connectionHandler = vi.mocked(mockServerEventHandler.enableConnectionEvent).mock.calls[0][0];
            connectionHandler(mockClient, {} as any);
        });

        it("should listen for USER_UPDATED_EVENT and emit to the correct client", () => {
            const userUpdateListener = eventBusListeners.get(USER_UPDATED_EVENT);
            expect(userUpdateListener).toBeDefined();

            vi.mocked(mockClient.emit).mockClear();

            const updatedUserPayload = { uuid: "user-123", name: "Neuer Name" };

            userUpdateListener!(updatedUserPayload);

            expect(mockClient.emit).not.toHaveBeenCalled();
            expect(mockClient.user).toEqual(updatedUserPayload);
        });

        it("should listen for MUSIC_STATE_UPDATED_EVENT and send to the correct client", () => {
            const musicStateListener = eventBusListeners.get(MUSIC_STATE_UPDATED_EVENT);
            expect(musicStateListener).toBeDefined();

            vi.mocked(mockClient.emit).mockClear();

            const musicUpdatePayload = { state: { item: { name: "Neuer Song" } } };
            const eventPayload = { uuid: "user-123", ...musicUpdatePayload };

            musicStateListener!(eventPayload);

            expect(mockClient.send).toHaveBeenCalledOnce();
            expect(mockClient.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "MUSIC_UPDATE", payload: musicUpdatePayload.state }),
                { binary: false }
            );
        });

        it("should listen for WEATHER_STATE_UPDATED_EVENT and send to the correct client", () => {
            const weatherStateListener = eventBusListeners.get(WEATHER_STATE_UPDATED_EVENT);
            expect(weatherStateListener).toBeDefined();

            vi.mocked(mockClient.emit).mockClear();

            const weatherUpdatePayload = { weatherData: { timezone: "Europe/Berlin", weather: { temp: 20 } } };
            const eventPayload = { subscribers: ["user-123"], ...weatherUpdatePayload };

            weatherStateListener!(eventPayload);

            expect(mockClient.send).toHaveBeenCalledOnce();
            expect(mockClient.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "WEATHER_UPDATE", payload: weatherUpdatePayload.weatherData }),
                { binary: false }
            );
        });

        it("should not send a message if the target client is not connected", () => {
            const userUpdateListener = eventBusListeners.get(USER_UPDATED_EVENT);
            const musicStateListener = eventBusListeners.get(MUSIC_STATE_UPDATED_EVENT);

            vi.mocked(mockClient.send).mockClear();
            vi.mocked(mockClient.emit).mockClear();

            const eventPayload = { uuid: "user-unknown", name: "some data" };

            userUpdateListener!(eventPayload);
            musicStateListener!(eventPayload);

            expect(mockClient.send).not.toHaveBeenCalled();
            expect(mockClient.emit).not.toHaveBeenCalled();
        });
    });
});

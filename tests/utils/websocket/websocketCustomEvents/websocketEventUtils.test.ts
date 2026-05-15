import { describe, it, expect, vi, beforeEach, type Mocked, afterEach } from "vitest";
import { ExtendedWebSocket } from "../../../../src/interfaces/extendedWebsocket";
import { GetStateEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getStateEvent";
import { GetSettingsEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getSettingsEvent";
import { SubscribeEvent } from "../../../../src/utils/websocket/websocketCustomEvents/subscribeEvent";
import { UnsubscribeEvent } from "../../../../src/utils/websocket/websocketCustomEvents/unsubscribeEvent";
import { MusicPollingService } from "../../../../src/services/musicPollingService";
import { TamagotchiPollingService } from "../../../../src/services/tamagotchiPollingService";
// @ts-ignore
import { appEventBus, COMMAND_SEND_STATE, COMMAND_SEND_SETTINGS } from "../../../../src/utils/eventBus";
import { createMockMusicPollingService, createMockOwmApiService } from "../../../helpers/testSetup";
import { ErrorEvent } from "../../../../src/utils/websocket/websocketCustomEvents/errorEvent";
import { WeatherPollingService } from "../../../../src/services/weatherPollingService";
import logger from "../../../../src/utils/logger";
import { OwmApiService } from "../../../../src/services/owmApiService";

const createMockWebSocket = (userPayload: any = {}): ExtendedWebSocket => {
    return {
        send: vi.fn(),
        emit: vi.fn(),
        user: {
            uuid: userPayload.uuid || "test-uuid-123",
            timezone: "Europe/Berlin",
            lastState: { global: { mode: "idle", brightness: 42 } },
            ...userPayload,
        },
        payload: { uuid: userPayload.uuid || "test-uuid-123" },
        asyncUpdates: new Map(),
    } as unknown as ExtendedWebSocket;
};

vi.mock("../../../../src/services/owmApiService", () => ({
    getCurrentWeather: vi.fn(),
}));

vi.mock("../../../../src/services/weatherPollingService");

vi.mock("../../../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock("../../../../src/utils/eventBus", () => ({
    appEventBus: {
        emit: vi.fn(),
    },
    COMMAND_SEND_STATE: "command:send-state",
    COMMAND_SEND_SETTINGS: "command:send-settings",
}));

describe("WebSocket Custom Event Handlers", () => {
    let mockmusicPollingService: Mocked<MusicPollingService>;
    let mockWeatherPollingService: Mocked<WeatherPollingService>;
    let mockTamagotchiPollingService: Mocked<TamagotchiPollingService>;
    let mockOwmApiService: Mocked<OwmApiService>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockmusicPollingService = createMockMusicPollingService() as any;
        mockOwmApiService = createMockOwmApiService() as any;
        mockWeatherPollingService = new WeatherPollingService(mockOwmApiService) as Mocked<WeatherPollingService>;
        mockTamagotchiPollingService = { startPollingForUser: vi.fn(), stopPollingForUser: vi.fn() } as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("GetStateEvent", () => {
        it("should emit COMMAND_SEND_STATE to the EventBus", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-123" });
            vi.mocked(appEventBus.emit).mockClear();

            const event = new GetStateEvent(mockWs);
            await event.handler();

            expect(appEventBus.emit).toHaveBeenCalledOnce();
            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_STATE, {
                uuid: "user-123",
                state: mockWs.user.lastState,
            });
            expect(mockWs.send).not.toHaveBeenCalled();
        });
    });

    describe("GetSettingsEvent", () => {
        it("should emit COMMAND_SEND_SETTINGS to the EventBus", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-123" });
            vi.mocked(appEventBus.emit).mockClear();

            const event = new GetSettingsEvent(mockWs);
            await event.handler();

            expect(appEventBus.emit).toHaveBeenCalledOnce();
            expect(appEventBus.emit).toHaveBeenCalledWith(COMMAND_SEND_SETTINGS, { uuid: "user-123" });
            expect(mockWs.send).not.toHaveBeenCalled();
        });
    });

    describe("SubscribeEvent", () => {
        it("should call music polling service when topic is music", async () => {
            const mockWs = createMockWebSocket();
            const event = new SubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("music");

            expect(mockmusicPollingService.startPollingForUser).toHaveBeenCalledOnce();
            expect(mockmusicPollingService.startPollingForUser).toHaveBeenCalledWith(mockWs.payload.uuid);
        });

        it("should call weather polling service when topic is clock", async () => {
            const location = { lat: 51.5074, lon: -0.1278 };
            const mockWs = createMockWebSocket({ uuid: "user-uuid", location });
            const event = new SubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("clock");

            expect(mockWeatherPollingService.subscribeUser).toHaveBeenCalledOnce();
        });

        it("should call tamagotchi polling service when topic is tamagotchi", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-uuid" });
            const event = new SubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("tamagotchi");

            expect(mockTamagotchiPollingService.startPollingForUser).toHaveBeenCalledOnce();
        });
    });

    describe("UnsubscribeEvent", () => {
        it("should call music polling service when topic is music", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-uuid-1" });
            const event = new UnsubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("music");

            expect(mockmusicPollingService.stopPollingForUser).toHaveBeenCalledOnce();
            expect(mockmusicPollingService.stopPollingForUser).toHaveBeenCalledWith("user-uuid-1");
        });

        it("should call weather polling service when topic is clock", async () => {
            const location = { lat: 51.5074, lon: -0.1278 };
            const mockWs = createMockWebSocket({ uuid: "user-uuid", location });
            const event = new UnsubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("clock");

            expect(mockWeatherPollingService.unsubscribeUser).toHaveBeenCalledOnce();
        });

        it("should call tamagotchi polling service when topic is tamagotchi", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-uuid" });
            const event = new UnsubscribeEvent(mockWs, mockWeatherPollingService, [
                ["music", mockmusicPollingService],
                ["tamagotchi", mockTamagotchiPollingService],
            ]);
            await event.handler("tamagotchi");

            expect(mockTamagotchiPollingService.stopPollingForUser).toHaveBeenCalledOnce();
        });
    });

    describe("ErrorEvent", () => {
        it("should log the received error message and traceback", async () => {
            const mockWs = createMockWebSocket();

            const event = new ErrorEvent(mockWs);
            const errorData = { message: "Client-Side Error", traceback: "Component > render > error" };
            await event.handler(errorData);

            expect(logger.warn).toHaveBeenCalledWith("Error message received", errorData.message);
            expect(logger.warn).toHaveBeenCalledWith("Traceback", errorData.traceback);
        });
    });
});

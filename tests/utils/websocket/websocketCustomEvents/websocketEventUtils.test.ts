import { describe, it, expect, vi, beforeEach, type Mocked, afterEach } from "vitest";
import { ExtendedWebSocket } from "../../../../src/interfaces/extendedWebsocket";
import { GetStateEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getStateEvent";
import { GetSettingsEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getSettingsEvent";
import { GetSpotifyUpdatesEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getSpotifyUpdatesEvent";
import { SpotifyPollingService } from "../../../../src/services/spotifyPollingService";
// @ts-ignore
import { createMockSpotifyPollingService } from "../../../helpers/testSetup";
import { StopSpotifyUpdatesEvent } from "../../../../src/utils/websocket/websocketCustomEvents/stopSpotifyUpdatesEvent";
import { GetWeatherUpdatesEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getWeatherUpdatesEvent";
import { ErrorEvent } from "../../../../src/utils/websocket/websocketCustomEvents/errorEvent";
import { UpdateUserSingleEvent } from "../../../../src/utils/websocket/websocketCustomEvents/updateUserEvent";
import { StopWeatherUpdatesEvent } from "../../../../src/utils/websocket/websocketCustomEvents/stopWeatherUpdatesEvent";
import { WeatherPollingService } from "../../../../src/services/weatherPollingService";
import logger from "../../../../src/utils/logger";

const createMockWebSocket = (userPayload: any = {}): ExtendedWebSocket => {
    return {
        send: vi.fn(),
        emit: vi.fn(),
        user: {
            timezone: "Europe/Berlin",
            lastState: { global: { mode: "idle", brightness: 42 } },
            ...userPayload,
        },
        payload: { uuid: "test-uuid-123" },
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

describe("WebSocket Custom Event Handlers", () => {
    let mockSpotifyPollingService: Mocked<SpotifyPollingService>;
    let mockWeatherPollingService: Mocked<WeatherPollingService>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockSpotifyPollingService = createMockSpotifyPollingService() as any;
        mockWeatherPollingService = new WeatherPollingService() as Mocked<WeatherPollingService>;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("GetStateEvent", () => {
        it("should send the user's lastState when its handler is called", async () => {
            const mockLastState = { global: { mode: "music", brightness: 100 } };
            const mockWs = createMockWebSocket({ lastState: mockLastState });

            const event = new GetStateEvent(mockWs);
            await event.handler();

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "STATE", payload: mockLastState }), {
                binary: false,
            });
        });
    });

    describe("GetSettingsEvent", () => {
        it("should send the user's settings when its handler is called", async () => {
            const mockTimezone = "America/New_York";
            const mockWs = createMockWebSocket({ timezone: mockTimezone });

            const event = new GetSettingsEvent(mockWs);
            await event.handler();

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "SETTINGS", payload: { timezone: mockTimezone } }),
                { binary: false }
            );
        });
    });

    describe("GetSpotifyUpdatesEvent", () => {
        it("should call the polling service to start polling for the user", async () => {
            const mockWs = createMockWebSocket();

            const event = new GetSpotifyUpdatesEvent(mockWs, mockSpotifyPollingService);
            await event.handler();

            expect(mockSpotifyPollingService.startPollingForUser).toHaveBeenCalledOnce();
            expect(mockSpotifyPollingService.startPollingForUser).toHaveBeenCalledWith(mockWs.user);
        });
    });

    describe("StopSpotifyUpdatesEvent", () => {
        it("should call the polling service to stop polling for the user", async () => {
            const mockWs = createMockWebSocket();

            const event = new StopSpotifyUpdatesEvent(mockWs, mockSpotifyPollingService);
            await event.handler();

            expect(mockSpotifyPollingService.stopPollingForUser).toHaveBeenCalledOnce();
            expect(mockSpotifyPollingService.stopPollingForUser).toHaveBeenCalledWith(mockWs.payload.uuid);
        });
    });

    describe("GetWeatherUpdatesEvent", () => {
        it("should subscribe the user to the WeatherPollingService using their location", async () => {
            const mockWs = createMockWebSocket({
                uuid: "user-uuid-weather",
                location: "London",
            });

            const event = new GetWeatherUpdatesEvent(mockWs, mockWeatherPollingService);
            await event.handler();

            expect(mockWeatherPollingService.subscribeUser).toHaveBeenCalledOnce();
            expect(mockWeatherPollingService.subscribeUser).toHaveBeenCalledWith("user-uuid-weather", "London");
        });

        it("should do nothing if the user has no location", async () => {
            const mockWs = createMockWebSocket({ location: undefined });

            const event = new GetWeatherUpdatesEvent(mockWs, mockWeatherPollingService);
            await event.handler();

            expect(mockWeatherPollingService.subscribeUser).not.toHaveBeenCalled();
        });
    });

    describe("StopWeatherUpdatesEvent", () => {
        it("should unsubscribe the user from the WeatherPollingService using their location", async () => {
            const mockWs = createMockWebSocket({
                uuid: "user-uuid-weather",
                location: "Paris",
            });

            const event = new StopWeatherUpdatesEvent(mockWs, mockWeatherPollingService);
            await event.handler();

            expect(mockWeatherPollingService.unsubscribeUser).toHaveBeenCalledOnce();
            expect(mockWeatherPollingService.unsubscribeUser).toHaveBeenCalledWith("user-uuid-weather", "Paris");
        });

        it("should do nothing if the user has no location", async () => {
            const mockWs = createMockWebSocket({ location: undefined });

            const event = new StopWeatherUpdatesEvent(mockWs, mockWeatherPollingService);
            await event.handler();

            expect(mockWeatherPollingService.unsubscribeUser).not.toHaveBeenCalled();
        });
    });

    describe("UpdateUserSingleEvent", () => {
        it("should update the user property on the websocket object", async () => {
            const mockWs = createMockWebSocket();
            const updatedUserData = { ...mockWs.user, name: "Neuer Name" };

            const event = new UpdateUserSingleEvent(mockWs);
            await event.handler(updatedUserData as any);

            expect(mockWs.user).toEqual(updatedUserData);
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

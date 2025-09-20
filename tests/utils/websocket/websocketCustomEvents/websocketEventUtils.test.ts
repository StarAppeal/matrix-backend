import {describe, it, expect, vi, beforeEach, type Mocked, afterEach} from "vitest";
import {ExtendedWebSocket} from "../../../../src/interfaces/extendedWebsocket";
import {GetStateEvent} from "../../../../src/utils/websocket/websocketCustomEvents/getStateEvent";
import {GetSettingsEvent} from "../../../../src/utils/websocket/websocketCustomEvents/getSettingsEvent";
import {GetSpotifyUpdatesEvent} from "../../../../src/utils/websocket/websocketCustomEvents/getSpotifyUpdatesEvent";
import {SpotifyPollingService} from "../../../../src/services/spotifyPollingService";
import {createMockSpotifyPollingService,} from "../../../helpers/testSetup";
import {StopSpotifyUpdatesEvent} from "../../../../src/utils/websocket/websocketCustomEvents/stopSpotifyUpdatesEvent";
import {
    GetSingleWeatherUpdateEvent,
    GetWeatherUpdatesEvent
} from "../../../../src/utils/websocket/websocketCustomEvents/getWeatherUpdatesEvent";
import {ErrorEvent} from "../../../../src/utils/websocket/websocketCustomEvents/errorEvent";
import {UpdateUserSingleEvent} from "../../../../src/utils/websocket/websocketCustomEvents/updateUserEvent";
import {StopWeatherUpdatesEvent} from "../../../../src/utils/websocket/websocketCustomEvents/stopWeatherUpdatesEvent";
import {getCurrentWeather} from "../../../../src/services/owmApiService";

const createMockWebSocket = (userPayload: any = {}): ExtendedWebSocket => {
    return {
        send: vi.fn(),
        emit: vi.fn(),
        user: {
            timezone: "Europe/Berlin",
            lastState: {global: {mode: "idle", brightness: 42}},
            ...userPayload,
        },
        payload: {uuid: "test-uuid-123"},
        asyncUpdates: new Map
    } as unknown as ExtendedWebSocket;
};

vi.mock("../../../../src/services/owmApiService", () => ({
    getCurrentWeather: vi.fn(),
}));

describe("WebSocket Custom Event Handlers", () => {

    let mockSpotifyPollingService: Mocked<SpotifyPollingService>;
    const mockedGetCurrentWeather = vi.mocked(getCurrentWeather);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockSpotifyPollingService = createMockSpotifyPollingService() as any;
    })

    afterEach(() => {
        vi.useRealTimers();
    });


    describe("GetStateEvent", () => {
        it("should send the user's lastState when its handler is called", async () => {
            const mockLastState = {global: {mode: "music", brightness: 100}};
            const mockWs = createMockWebSocket({lastState: mockLastState});

            const event = new GetStateEvent(mockWs);
            await event.handler();

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({type: "STATE", payload: mockLastState}),
                {binary: false}
            );
        });
    });

    describe("GetSettingsEvent", () => {
        it("should send the user's settings when its handler is called", async () => {
            const mockTimezone = "America/New_York";
            const mockWs = createMockWebSocket({timezone: mockTimezone});

            const event = new GetSettingsEvent(mockWs);
            await event.handler();

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({type: "SETTINGS", payload: {timezone: mockTimezone}}),
                {binary: false}
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
        it("should emit a single weather update immediately", async () => {
            const mockWs = createMockWebSocket();
            const event = new GetWeatherUpdatesEvent(mockWs);

            await event.handler();

            expect(mockWs.emit).toHaveBeenCalledWith("GET_SINGLE_WEATHER_UPDATE");
        });

        it("should set up an interval to emit weather updates periodically", async () => {
            const mockWs = createMockWebSocket();
            const event = new GetWeatherUpdatesEvent(mockWs);

            await event.handler();

            expect(mockWs.emit).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(60 * 1000);
            expect(mockWs.emit).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(60 * 1000);
            expect(mockWs.emit).toHaveBeenCalledTimes(3);
        });

        it("should not set up a new interval if one is already running", async () => {
            const mockWs = createMockWebSocket();
            const intervalId = setInterval(() => {}, 1000); // Simuliere einen laufenden Timer
            mockWs.asyncUpdates.set("WEATHER_UPDATE", intervalId);
            const event = new GetWeatherUpdatesEvent(mockWs);

            await event.handler();

            expect(mockWs.asyncUpdates.get("WEATHER_UPDATE")).toBe(intervalId);
            expect(mockWs.emit).toHaveBeenCalledOnce();
        });

    });

    describe("GetSingleWeatherUpdateEvent", () => {
        it("should fetch weather and send an update to the client", async () => {
            const mockWs = createMockWebSocket({ location: "London" });
            const weatherData = { temp: 15, city: "London" };
            mockedGetCurrentWeather.mockResolvedValue(weatherData as any);

            const event = new GetSingleWeatherUpdateEvent(mockWs);
            await event.handler();

            expect(mockedGetCurrentWeather).toHaveBeenCalledOnce();
            expect(mockedGetCurrentWeather).toHaveBeenCalledWith("London");

            expect(mockWs.send).toHaveBeenCalledOnce();
            const expectedMessage = JSON.stringify({ type: "WEATHER_UPDATE", payload: weatherData });
            expect(mockWs.send).toHaveBeenCalledWith(expectedMessage, { binary: false });
        });
    });

    describe("StopWeatherUpdatesEvent", () => {
        it("should clear the weather update interval if it exists", async () => {
            
            const mockWs = createMockWebSocket();
            const intervalId = setInterval(() => {}, 1000);
            mockWs.asyncUpdates.set("WEATHER_UPDATE", intervalId);

            const event = new StopWeatherUpdatesEvent(mockWs);
            await event.handler();

            expect(mockWs.asyncUpdates.has("WEATHER_UPDATE")).toBe(false);
            expect(vi.getTimerCount()).toBe(0);
        });

        it("should do nothing if no weather update interval is running", async () => {
            const mockWs = createMockWebSocket();

            const event = new StopWeatherUpdatesEvent(mockWs);
            await event.handler();

            expect(mockWs.asyncUpdates.size).toBe(0);
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
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const event = new ErrorEvent(mockWs);
            const errorData = { message: "Client-Side Error", traceback: "Component > render > error" };
            await event.handler(errorData);

            expect(consoleWarnSpy).toHaveBeenCalledWith("Error message received", errorData.message);
            expect(consoleWarnSpy).toHaveBeenCalledWith("Traceback", errorData.traceback);
        });
    });
});
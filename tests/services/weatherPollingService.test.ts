import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from "vitest";
import { appEventBus, USER_UPDATED_EVENT, WEATHER_STATE_UPDATED_EVENT } from "../../src/utils/eventBus";
import { WeatherPollingService } from "../../src/services/weatherPollingService";
import { IUser } from "../../src/db/models/user";
import { getCurrentWeather } from "../../src/services/owmApiService";

vi.mock("../../src/services/owmApiService");

vi.mock("../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn(),
        emit: vi.fn(),
    },
    WEATHER_STATE_UPDATED_EVENT: "weather:state-updated",
    USER_UPDATED_EVENT: "user:updated",
}));

vi.mock("../../src/services/owmApiService", () => ({
    getCurrentWeather: vi.fn(),
}));

describe("WeatherPollingService", () => {
    let mockedAppEventBus: Mocked<typeof appEventBus>;
    const mockedGetCurrentWeather = vi.mocked(getCurrentWeather);

    let pollingService: WeatherPollingService;

    const BERLIN_COORDS = { lat: 52.52, lon: 13.40 };
    const LONDON_COORDS = { lat: 51.50, lon: -0.12 };

    const BERLIN_KEY = "52.52,13.4";
    const LONDON_KEY = "51.5,-0.12";

    const mockUser: IUser = {
        uuid: "user-123",
        location: BERLIN_COORDS,
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockedAppEventBus = appEventBus as Mocked<typeof appEventBus>;
        pollingService = new WeatherPollingService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("Subscription Management", () => {
        it("should start a new poll when the first user subscribes to a location", async () => {
            mockedGetCurrentWeather.mockResolvedValue({ temp: 10 } as any);

            pollingService.subscribeUser(mockUser.uuid, BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);
            expect(mockedGetCurrentWeather).toHaveBeenCalledWith(BERLIN_COORDS.lat, BERLIN_COORDS.lon);
        });

        it("should NOT start a new poll if another user subscribes to the same location", async () => {
            pollingService.subscribeUser("user-1", BERLIN_COORDS.lat, BERLIN_COORDS.lon);
            pollingService.subscribeUser("user-2", BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);
            expect(mockedGetCurrentWeather).toHaveBeenCalledTimes(1);
        });

        it("should stop the poll when the last user unsubscribes from a location", async () => {
            // @ts-ignore - access to private property for test purposes
            const activePolls = (pollingService as any).activeLocationPolls;

            pollingService.subscribeUser("user-1", BERLIN_COORDS.lat, BERLIN_COORDS.lon);
            pollingService.subscribeUser("user-2", BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            await vi.advanceTimersByTimeAsync(0);

            expect(activePolls.has(BERLIN_KEY)).toBe(true);

            pollingService.unsubscribeUser("user-1", BERLIN_COORDS.lat, BERLIN_COORDS.lon);
            expect(activePolls.has(BERLIN_KEY)).toBe(true);

            // @ts-ignore - access to private method spy
            const stopPollingSpy = vi.spyOn(pollingService as any, "_stopPollingForLocation");

            pollingService.unsubscribeUser("user-2", BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            expect(stopPollingSpy).toHaveBeenCalledWith(BERLIN_KEY);
            expect(activePolls.has(BERLIN_KEY)).toBe(false);
        });
    });

    describe("Polling and Event Emission", () => {
        it("should periodically poll the API and emit an event for all subscribers of that location", async () => {
            const weatherData = { temp: 12, city: "London" };
            mockedGetCurrentWeather.mockResolvedValue(weatherData as any);

            pollingService.subscribeUser("user-london-1", LONDON_COORDS.lat, LONDON_COORDS.lon);
            pollingService.subscribeUser("user-london-2", LONDON_COORDS.lat, LONDON_COORDS.lon);

            await vi.advanceTimersByTimeAsync(0);

            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(WEATHER_STATE_UPDATED_EVENT, {
                weatherData,
                subscribers: expect.arrayContaining(["user-london-1", "user-london-2"]),
            });

            await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(3);
        });
    });

    describe("Automatic Location Change Handling (via USER_UPDATED_EVENT)", () => {
        let userUpdateListener: (user: IUser) => void;

        beforeEach(() => {
            const onCall = mockedAppEventBus.on.mock.calls.find((call) => call[0] === USER_UPDATED_EVENT);
            if (onCall) {
                userUpdateListener = onCall[1];
            }
        });

        it("should be listening for USER_UPDATED_EVENT", () => {
            expect(userUpdateListener).toBeDefined();
            expect(typeof userUpdateListener).toBe("function");
        });

        it("should automatically move a user's subscription when their location changes", () => {
            const unsubscribeSpy = vi.spyOn(pollingService, "unsubscribeUser");
            const subscribeSpy = vi.spyOn(pollingService, "subscribeUser");

            pollingService.subscribeUser("user-moving", BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            const updatedUser = {
                uuid: "user-moving",
                location: LONDON_COORDS
            } as IUser;

            userUpdateListener(updatedUser);

            expect(subscribeSpy).toHaveBeenCalledTimes(2);
            expect(subscribeSpy).toHaveBeenLastCalledWith("user-moving", LONDON_COORDS.lat, LONDON_COORDS.lon);

            // @ts-ignore
            const subs = (pollingService as any).locationSubscriptions;
            expect(subs.get(BERLIN_KEY)?.has("user-moving")).toBeFalsy();
            expect(subs.get(LONDON_KEY)?.has("user-moving")).toBe(true);
        });

        it("should do nothing if the user's location has not changed", () => {
            const subscribeSpy = vi.spyOn(pollingService, "subscribeUser");

            pollingService.subscribeUser("user-staying", BERLIN_COORDS.lat, BERLIN_COORDS.lon);

            const updatedUser = {
                uuid: "user-staying",
                location: BERLIN_COORDS,
                name: "New Name"
            } as IUser;

            userUpdateListener(updatedUser);

            expect(subscribeSpy).toHaveBeenCalledTimes(1); // Nur das initiale
        });
    });
});
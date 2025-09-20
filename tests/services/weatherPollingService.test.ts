import {describe, it, expect, vi, beforeEach, afterEach, Mocked} from "vitest";
import {appEventBus, USER_UPDATED_EVENT, WEATHER_STATE_UPDATED_EVENT} from "../../src/utils/eventBus";
import {WeatherPollingService} from "../../src/services/weatherPollingService";
import {IUser} from "../../src/db/models/user";
import {getCurrentWeather} from "../../src/services/owmApiService";


vi.mock("../../src/services/owmApiService");

vi.mock("../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn(),
        emit: vi.fn(),
    },
    WEATHER_STATE_UPDATED_EVENT: 'weather:state-updated',
    USER_UPDATED_EVENT: 'user:updated',
}));

vi.mock("../../src/services/owmApiService", () => ({
    getCurrentWeather: vi.fn(),
}));

describe("WeatherPollingService", () => {
    let mockedAppEventBus: Mocked<typeof appEventBus>;
    const mockedGetCurrentWeather = vi.mocked(getCurrentWeather);

    let pollingService: WeatherPollingService;

    const mockUser: IUser = {
        uuid: "user-123",
        location: "Berlin",
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

            pollingService.subscribeUser(mockUser.uuid, mockUser.location);

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);
            expect(mockedGetCurrentWeather).toHaveBeenCalledOnce();
        });

        it("should NOT start a new poll if another user subscribes to the same location", async () => {
            pollingService.subscribeUser("user-1", "Berlin");
            pollingService.subscribeUser("user-2", "Berlin");

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);
            expect(mockedGetCurrentWeather).toHaveBeenCalledTimes(1);
        });

        it("should stop the poll when the last user unsubscribes from a location", async () => {
            pollingService.subscribeUser("user-1", "Berlin");
            pollingService.subscribeUser("user-2", "Berlin");

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);

            pollingService.unsubscribeUser("user-1", "Berlin");
            expect(vi.getTimerCount()).toBe(1);

            pollingService.unsubscribeUser("user-2", "Berlin");
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe("Polling and Event Emission", () => {
        it("should periodically poll the API and emit an event for all subscribers of that location", async () => {
            const weatherData = { temp: 12, city: "London" };
            mockedGetCurrentWeather.mockResolvedValue(weatherData as any);

            pollingService.subscribeUser("user-london-1", "London");
            pollingService.subscribeUser("user-london-2", "London");

            await vi.advanceTimersByTimeAsync(0);
            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(WEATHER_STATE_UPDATED_EVENT, {
                weatherData,
                subscribers: ["user-london-1", "user-london-2"],
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
            const onCall = mockedAppEventBus.on.mock.calls.find(
                call => call[0] === USER_UPDATED_EVENT
            );
            if (onCall) {
                userUpdateListener = onCall[1];
            }
        });

        it("should be listening for USER_UPDATED_EVENT", () => {
            expect(userUpdateListener).toBeDefined();
            expect(typeof userUpdateListener).toBe("function");
        });

        it("should automatically move a user's subscription when their location changes", () => {
            const unsubscribeSpy = vi.spyOn(pollingService, 'unsubscribeUser');
            const subscribeSpy = vi.spyOn(pollingService, 'subscribeUser');

            pollingService.subscribeUser("user-moving", "Berlin");

            const updatedUser = { uuid: "user-moving", location: "London" } as IUser;
            userUpdateListener(updatedUser);

            expect(unsubscribeSpy).toHaveBeenCalledOnce();
            expect(unsubscribeSpy).toHaveBeenCalledWith("user-moving", "Berlin");

            expect(subscribeSpy).toHaveBeenCalledTimes(2); // Once for Berlin, once for London
            expect(subscribeSpy).toHaveBeenCalledWith("user-moving", "London");
        });

        it("should do nothing if the user's location has not changed", () => {
            const unsubscribeSpy = vi.spyOn(pollingService, 'unsubscribeUser');

            pollingService.subscribeUser("user-staying", "Berlin");

            const updatedUser = { uuid: "user-staying", location: "Berlin", name: "New Name" } as IUser;
            userUpdateListener(updatedUser);

            expect(unsubscribeSpy).not.toHaveBeenCalled();
        });
    });
});
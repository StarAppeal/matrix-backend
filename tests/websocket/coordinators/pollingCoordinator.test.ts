import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import {
    appEventBus,
    WEBSOCKET_CLIENT_DISCONNECTED,
    WEBSOCKET_SUBSCRIBE_REQUEST,
    WEBSOCKET_UNSUBSCRIBE_REQUEST,
} from "../../../src/utils/eventBus";
import { PollingCoordinator } from "../../../src/websocket/coordinators/pollingCoordinator";
import { MusicPollingService } from "../../../src/services/musicPollingService";
import { WeatherPollingService } from "../../../src/services/weatherPollingService";
import { TamagotchiPollingService } from "../../../src/services/tamagotchiPollingService";

const eventBusListeners = new Map<string, (...args: any[]) => void>();

vi.mock("../../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn((event, listener) => {
            eventBusListeners.set(event, listener);
        }),
        emit: vi.fn(),
    },
    WEBSOCKET_CLIENT_DISCONNECTED: "websocket:client_disconnected",
    WEBSOCKET_SUBSCRIBE_REQUEST: "websocket:subscribe_request",
    WEBSOCKET_UNSUBSCRIBE_REQUEST: "websocket:unsubscribe_request",
}));

describe("PollingCoordinator", () => {
    let mockMusicService: Mocked<MusicPollingService>;
    let mockWeatherService: Mocked<WeatherPollingService>;
    let mockTamagotchiService: Mocked<TamagotchiPollingService>;
    let coordinator: PollingCoordinator;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBusListeners.clear();

        mockMusicService = {
            startPollingForUser: vi.fn(),
            stopPollingForUser: vi.fn(),
        } as unknown as Mocked<MusicPollingService>;

        mockWeatherService = {
            subscribeUser: vi.fn(),
            unsubscribeUser: vi.fn(),
        } as unknown as Mocked<WeatherPollingService>;

        mockTamagotchiService = {
            startPollingForUser: vi.fn(),
            stopPollingForUser: vi.fn(),
        } as unknown as Mocked<TamagotchiPollingService>;

        coordinator = new PollingCoordinator(mockMusicService, mockWeatherService, mockTamagotchiService);
    });

    it("should register event bus listeners on init", () => {
        expect(appEventBus.on).toHaveBeenCalledWith(WEBSOCKET_CLIENT_DISCONNECTED, expect.any(Function));
        expect(appEventBus.on).toHaveBeenCalledWith(WEBSOCKET_SUBSCRIBE_REQUEST, expect.any(Function));
        expect(appEventBus.on).toHaveBeenCalledWith(WEBSOCKET_UNSUBSCRIBE_REQUEST, expect.any(Function));
    });

    describe("WEBSOCKET_CLIENT_DISCONNECTED", () => {
        it("should stop music and tamagotchi polling, and unsubscribe weather if location exists", () => {
            const disconnectHandler = eventBusListeners.get(WEBSOCKET_CLIENT_DISCONNECTED);
            expect(disconnectHandler).toBeDefined();

            const mockUser = {
                uuid: "user-123",
                location: { lat: 10.5, lon: 20.5 },
            };

            disconnectHandler!({ uuid: "user-123", user: mockUser });

            expect(mockMusicService.stopPollingForUser).toHaveBeenCalledWith("user-123");
            expect(mockTamagotchiService.stopPollingForUser).toHaveBeenCalledWith("user-123");
            expect(mockWeatherService.unsubscribeUser).toHaveBeenCalledWith("user-123", 10.5, 20.5);
        });

        it("should stop music and tamagotchi polling, but skip weather unsubscription if no location", () => {
            const disconnectHandler = eventBusListeners.get(WEBSOCKET_CLIENT_DISCONNECTED);
            disconnectHandler!({ uuid: "user-123", user: { uuid: "user-123" } });

            expect(mockMusicService.stopPollingForUser).toHaveBeenCalledWith("user-123");
            expect(mockTamagotchiService.stopPollingForUser).toHaveBeenCalledWith("user-123");
            expect(mockWeatherService.unsubscribeUser).not.toHaveBeenCalled();
        });
    });

    describe("WEBSOCKET_SUBSCRIBE_REQUEST", () => {
        it("should start music polling when topic is music", () => {
            const handler = eventBusListeners.get(WEBSOCKET_SUBSCRIBE_REQUEST);
            handler!({ uuid: "user-123", topic: "music", user: {} });

            expect(mockMusicService.startPollingForUser).toHaveBeenCalledWith("user-123");
            expect(mockWeatherService.subscribeUser).not.toHaveBeenCalled();
        });

        it("should start tamagotchi polling when topic is tamagotchi", () => {
            const handler = eventBusListeners.get(WEBSOCKET_SUBSCRIBE_REQUEST);
            handler!({ uuid: "user-123", topic: "tamagotchi", user: {} });

            expect(mockTamagotchiService.startPollingForUser).toHaveBeenCalledWith("user-123");
        });

        it("should subscribe to weather when topic is clock and location is present", () => {
            const handler = eventBusListeners.get(WEBSOCKET_SUBSCRIBE_REQUEST);
            const user = { location: { lat: 1, lon: 2 } };
            handler!({ uuid: "user-123", topic: "clock", user });

            expect(mockWeatherService.subscribeUser).toHaveBeenCalledWith("user-123", 1, 2);
        });
    });

    describe("WEBSOCKET_UNSUBSCRIBE_REQUEST", () => {
        it("should stop music polling when topic is music", () => {
            const handler = eventBusListeners.get(WEBSOCKET_UNSUBSCRIBE_REQUEST);
            handler!({ uuid: "user-123", topic: "music", user: {} });

            expect(mockMusicService.stopPollingForUser).toHaveBeenCalledWith("user-123");
        });

        it("should stop tamagotchi polling when topic is tamagotchi", () => {
            const handler = eventBusListeners.get(WEBSOCKET_UNSUBSCRIBE_REQUEST);
            handler!({ uuid: "user-123", topic: "tamagotchi", user: {} });

            expect(mockTamagotchiService.stopPollingForUser).toHaveBeenCalledWith("user-123");
        });

        it("should unsubscribe weather when topic is clock and location is present", () => {
            const handler = eventBusListeners.get(WEBSOCKET_UNSUBSCRIBE_REQUEST);
            const user = { location: { lat: 1, lon: 2 } };
            handler!({ uuid: "user-123", topic: "clock", user });

            expect(mockWeatherService.unsubscribeUser).toHaveBeenCalledWith("user-123", 1, 2);
        });
    });
});

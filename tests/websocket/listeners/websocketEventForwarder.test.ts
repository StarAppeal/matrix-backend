import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import {
    appEventBus,
    USER_UPDATED_EVENT,
    COMMAND_SEND_SETTINGS,
    WEATHER_STATE_UPDATED_EVENT,
    TAMAGOTCHI_STATE_UPDATED_EVENT,
} from "../../../src/utils/eventBus";
import { WebsocketEventForwarder } from "../../../src/websocket/listeners/websocketEventForwarder";
import { ExtendedWebSocketServer } from "../../../src/websocket";

const eventBusListeners = new Map<string, (...args: any[]) => void>();

vi.mock("../../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn((event, listener) => {
            eventBusListeners.set(event, listener);
        }),
        emit: vi.fn(),
    },
    USER_UPDATED_EVENT: "user:updated",
    COMMAND_SEND_SETTINGS: "command:send_settings",
    WEATHER_STATE_UPDATED_EVENT: "weather:updated",
    TAMAGOTCHI_STATE_UPDATED_EVENT: "tamagotchi:updated",
}));

describe("WebsocketEventForwarder", () => {
    let mockWss: Mocked<ExtendedWebSocketServer>;
    let forwarder: WebsocketEventForwarder;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBusListeners.clear();

        mockWss = {
            updateUserInMap: vi.fn(),
            getUser: vi.fn(),
            sendPayload: vi.fn(),
        } as unknown as Mocked<ExtendedWebSocketServer>;

        forwarder = new WebsocketEventForwarder(mockWss);
    });

    it("should register all simple event listeners on init", () => {
        expect(appEventBus.on).toHaveBeenCalledWith(USER_UPDATED_EVENT, expect.any(Function));
        expect(appEventBus.on).toHaveBeenCalledWith(COMMAND_SEND_SETTINGS, expect.any(Function));
        expect(appEventBus.on).toHaveBeenCalledWith(WEATHER_STATE_UPDATED_EVENT, expect.any(Function));
        expect(appEventBus.on).toHaveBeenCalledWith(TAMAGOTCHI_STATE_UPDATED_EVENT, expect.any(Function));
    });

    it("should handle USER_UPDATED_EVENT by updating user in map", () => {
        const handler = eventBusListeners.get(USER_UPDATED_EVENT);
        const mockUser = { uuid: "user-1", name: "User 1" };

        handler!(mockUser);

        expect(mockWss.updateUserInMap).toHaveBeenCalledWith(mockUser);
    });

    it("should handle COMMAND_SEND_SETTINGS by sending user timezone settings", () => {
        const handler = eventBusListeners.get(COMMAND_SEND_SETTINGS);
        mockWss.getUser.mockReturnValue({ uuid: "user-1", timezone: "America/New_York" } as any);

        handler!({ uuid: "user-1" });

        expect(mockWss.getUser).toHaveBeenCalledWith("user-1");
        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "SETTINGS", { timezone: "America/New_York" });
    });

    it("should handle WEATHER_STATE_UPDATED_EVENT by sending to all subscribers", () => {
        const handler = eventBusListeners.get(WEATHER_STATE_UPDATED_EVENT);
        const weatherData = { temp: 22 };

        handler!({ weatherData, subscribers: ["user-1", "user-2"] });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "WEATHER_UPDATE", weatherData);
        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-2", "WEATHER_UPDATE", weatherData);
    });

    it("should handle TAMAGOTCHI_STATE_UPDATED_EVENT by sending update payload", () => {
        const handler = eventBusListeners.get(TAMAGOTCHI_STATE_UPDATED_EVENT);
        const petPayload = { status: "happy" };

        handler!({ uuid: "user-1", payload: petPayload });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "TAMAGOTCHI_UPDATE", petPayload);
    });
});

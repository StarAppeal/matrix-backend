import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExtendedWebSocket } from "../../../../src/interfaces/extendedWebsocket";
import { GetStateEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getStateEvent";
import { GetSettingsEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getSettingsEvent";
import { SubscribeEvent } from "../../../../src/utils/websocket/websocketCustomEvents/subscribeEvent";
import { UnsubscribeEvent } from "../../../../src/utils/websocket/websocketCustomEvents/unsubscribeEvent";
import { appEventBus, COMMAND_SEND_STATE, COMMAND_SEND_SETTINGS, WEBSOCKET_SUBSCRIBE_REQUEST, WEBSOCKET_UNSUBSCRIBE_REQUEST } from "../../../../src/utils/eventBus";
import { ErrorEvent } from "../../../../src/utils/websocket/websocketCustomEvents/errorEvent";
import logger from "../../../../src/utils/logger";

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
    WEBSOCKET_SUBSCRIBE_REQUEST: "websocket:subscribe_request",
    WEBSOCKET_UNSUBSCRIBE_REQUEST: "websocket:unsubscribe_request",
}));

describe("WebSocket Custom Event Handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
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
        it("should emit WEBSOCKET_SUBSCRIBE_REQUEST to the EventBus", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-123" });
            vi.mocked(appEventBus.emit).mockClear();

            const event = new SubscribeEvent(mockWs);
            await event.handler("music");

            expect(appEventBus.emit).toHaveBeenCalledOnce();
            expect(appEventBus.emit).toHaveBeenCalledWith(WEBSOCKET_SUBSCRIBE_REQUEST, {
                uuid: "user-123",
                topic: "music",
                user: mockWs.user,
            });
        });
    });

    describe("UnsubscribeEvent", () => {
        it("should emit WEBSOCKET_UNSUBSCRIBE_REQUEST to the EventBus", async () => {
            const mockWs = createMockWebSocket({ uuid: "user-123" });
            vi.mocked(appEventBus.emit).mockClear();

            const event = new UnsubscribeEvent(mockWs);
            await event.handler("music");

            expect(appEventBus.emit).toHaveBeenCalledOnce();
            expect(appEventBus.emit).toHaveBeenCalledWith(WEBSOCKET_UNSUBSCRIBE_REQUEST, {
                uuid: "user-123",
                topic: "music",
                user: mockWs.user,
            });
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

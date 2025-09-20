import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { WebsocketEventHandler } from "../../../src/utils/websocket/websocketEventHandler";
import { ExtendedWebSocket } from "../../../src/interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "../../../src/utils/websocket/websocketCustomEvents/customWebsocketEvent";
import {SpotifyPollingService} from "../../../src/services/spotifyPollingService";
import {WeatherPollingService} from "../../../src/services/weatherPollingService";

describe("WebsocketEventHandler", () => {
    let mockWebSocket: Mocked<ExtendedWebSocket>;
    let websocketEventHandler: WebsocketEventHandler;
    let mockSpotifyPollingService: Mocked<SpotifyPollingService>
    let mockWeatherPollingService: Mocked<WeatherPollingService>
    let registeredHandlers: Map<string, (...args: any[]) => void>;

    beforeEach(() => {
        vi.clearAllMocks();

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});

        registeredHandlers = new Map();

        mockWebSocket = {
            on: vi.fn((event, handler) => {
                registeredHandlers.set(event, handler);
                return mockWebSocket;
            }),
            emit: vi.fn(),
            isAlive: false,
            payload: { username: "testuser", uuid: "test-uuid", id: "test-id" },
            asyncUpdates: new Map([["update1", 123], ["update2", 456]]),
        } as unknown as Mocked<ExtendedWebSocket>;

        // not used in this test
        mockSpotifyPollingService = {} as Mocked<SpotifyPollingService>;
        mockWeatherPollingService = {} as Mocked<WeatherPollingService>;

        websocketEventHandler = new WebsocketEventHandler(mockWebSocket, mockSpotifyPollingService, mockWeatherPollingService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should register an error event handler", () => {
        websocketEventHandler.enableErrorEvent();
        expect(mockWebSocket.on).toHaveBeenCalledWith("error", console.error);
    });

    it("should register a pong event handler that sets isAlive to true", () => {
        websocketEventHandler.enablePongEvent();

        const pongHandler = registeredHandlers.get("pong");
        expect(pongHandler).toBeDefined();

        pongHandler!();

        expect(mockWebSocket.isAlive).toBe(true);
        expect(console.log).toHaveBeenCalledWith("Pong received");
    });

    describe("enableDisconnectEvent", () => {
        it("should set onclose handler, clear async updates, and call the callback", () => {
            const mockCallback = vi.fn();
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");

            websocketEventHandler.enableDisconnectEvent(mockCallback);
            expect(mockWebSocket.onclose).toBeInstanceOf(Function);

            mockWebSocket.onclose!({ code: 1000, reason: "Normal" } as any);

            expect(console.log).toHaveBeenCalledWith("User: testuser disconnected");
            expect(clearIntervalSpy).toHaveBeenCalledWith(123);
            expect(clearIntervalSpy).toHaveBeenCalledWith(456);
            expect(mockCallback).toHaveBeenCalledOnce();
        });

        it("should handle disconnect with no async updates", () => {
            const mockCallback = vi.fn();
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");

            websocketEventHandler.enableDisconnectEvent(mockCallback);
            mockWebSocket.onclose!({ code: 1000, reason: "Normal" } as any);

            expect(clearIntervalSpy).not.toHaveBeenCalled();
            expect(mockCallback).toHaveBeenCalledOnce();
        });
    });

    describe("enableMessageEvent", () => {
        it("should parse incoming JSON messages and emit them as typed events", () => {
            websocketEventHandler.enableMessageEvent();

            const messageHandler = registeredHandlers.get("message");
            expect(messageHandler).toBeDefined();

            const message = { type: "test_event", data: { value: 42 } };
            const rawData = { toString: () => JSON.stringify(message) };

            messageHandler!(rawData);

            expect(console.log).toHaveBeenCalledWith("Received message:", JSON.stringify(message));
            expect(mockWebSocket.emit).toHaveBeenCalledWith("test_event", message);
        });
    });

    describe("registerCustomEvent", () => {
        it("should register a custom event with its handler bound to the event object", () => {
            const mockHandler = vi.fn();
            const customEvent: CustomWebsocketEvent = {
                event: "custom_event",
                handler: mockHandler,
            } as any;

            // @ts-ignore
            const bindSpy = vi.spyOn(customEvent.handler, "bind");

            // @ts-ignore - Access to private method for testing purposes
            websocketEventHandler.registerCustomEvent(customEvent);

            expect(mockWebSocket.on).toHaveBeenCalledWith("custom_event", expect.any(Function));
            expect(bindSpy).toHaveBeenCalledWith(customEvent);
        });
    });
});
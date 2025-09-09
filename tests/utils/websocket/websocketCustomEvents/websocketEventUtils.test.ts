import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { getEventListeners } from "../../../../src/utils/websocket/websocketCustomEvents/websocketEventUtils";
import { WebsocketEventType } from "../../../../src/utils/websocket/websocketCustomEvents/websocketEventType";
import { CustomWebsocketEvent } from "../../../../src/utils/websocket/websocketCustomEvents/customWebsocketEvent";

type MockWs = {
    user: {
        timezone: string;
        lastState: { global: { mode: string; brightness: number } };
    };
    send: Mocked<(data: any, options: { binary: boolean }) => void>;
};

describe("websocketEventUtils.getEventListeners", () => {
    let mockWs: MockWs;
    let listeners: CustomWebsocketEvent[];

    beforeEach(() => {
        mockWs = {
            user: {
                timezone: "Europe/Berlin",
                lastState: { global: { mode: "idle", brightness: 42 } },
            },
            send: vi.fn(),
        };
        listeners = getEventListeners(mockWs as any);
    });

    it("should return an array of event listener objects", () => {
        expect(Array.isArray(listeners)).toBe(true);
        expect(listeners.length).toBeGreaterThan(0);

        for (const listener of listeners) {
            expect(listener).toHaveProperty("event");
            expect(listener).toHaveProperty("handler");
            expect(typeof listener.handler).toBe("function");
        }
    });

    describe("GET_STATE event handler", () => {
        it("should include a handler for GET_STATE", () => {
            const getStateListener = listeners.find(l => l.event === WebsocketEventType.GET_STATE);
            expect(getStateListener).toBeDefined();
        });

        it("should send the user's last state when the handler is called", () => {
            const getStateListener = listeners.find(l => l.event === WebsocketEventType.GET_STATE);

            getStateListener!.handler({});

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "STATE", payload: mockWs.user.lastState }),
                { binary: false }
            );
        });
    });

    describe("GET_SETTINGS event handler", () => {
        it("should include a handler for GET_SETTINGS", () => {
            const getSettingsListener = listeners.find(l => l.event === WebsocketEventType.GET_SETTINGS);
            expect(getSettingsListener).toBeDefined();
        });

        it("should send the user's timezone when the handler is called", () => {
            const getSettingsListener = listeners.find(l => l.event === WebsocketEventType.GET_SETTINGS);

            getSettingsListener!.handler({});

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "SETTINGS", payload: { timezone: mockWs.user.timezone } }),
                { binary: false }
            );
        });
    });
});
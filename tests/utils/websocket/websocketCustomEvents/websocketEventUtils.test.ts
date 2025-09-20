import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExtendedWebSocket } from "../../../../src/interfaces/extendedWebsocket";
import { GetStateEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getStateEvent";
import { GetSettingsEvent } from "../../../../src/utils/websocket/websocketCustomEvents/getSettingsEvent";

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
    } as unknown as ExtendedWebSocket;
};


describe("WebSocket Custom Event Handlers", () => {


    describe("GetStateEvent", () => {
        it("should send the user's lastState when its handler is called", async () => {
            const mockLastState = { global: { mode: "music", brightness: 100 } };
            const mockWs = createMockWebSocket({ lastState: mockLastState });

            const event = new GetStateEvent(mockWs);
            await event.handler();

            expect(mockWs.send).toHaveBeenCalledOnce();
            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "STATE", payload: mockLastState }),
                { binary: false }
            );
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

});
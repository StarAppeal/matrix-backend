import { describe, it, expect, vi } from "vitest";
import { getEventListeners } from "../../../../src/utils/websocket/websocketCustomEvents/websocketEventUtils";
import { WebsocketEventType } from "../../../../src/utils/websocket/websocketCustomEvents/websocketEventType";

describe("websocketEventUtils.getEventListeners", () => {
    function makeWs() {
        return {
            user: {
                timezone: "Europe/Berlin",
                lastState: { global: { mode: "idle", brightness: 42 } },
            },
            send: vi.fn(),
        };
    }

    it("returns a list of event-handlers incl. GET_STATE/GET_SETTINGS", async () => {
        const ws: any = makeWs();
        const listeners = getEventListeners(ws);

        expect(Array.isArray(listeners)).toBe(true);
        expect(listeners.length).toBeGreaterThan(0);

        const byType = Object.fromEntries(listeners.map(l => [l.event, l]));

        expect(byType[WebsocketEventType.GET_STATE]).toBeTruthy();
        byType[WebsocketEventType.GET_STATE].handler({});
        expect(ws.send).toHaveBeenCalledWith(
            JSON.stringify({ type: "STATE", payload: ws.user.lastState }),
            { binary: false },
        );

        ws.send.mockClear();
        expect(byType[WebsocketEventType.GET_SETTINGS]).toBeTruthy();
        byType[WebsocketEventType.GET_SETTINGS].handler({});
        expect(ws.send).toHaveBeenCalledWith(
            JSON.stringify({ type: "SETTINGS", payload: { timezone: ws.user.timezone } }),
            { binary: false },
        );
    });
});
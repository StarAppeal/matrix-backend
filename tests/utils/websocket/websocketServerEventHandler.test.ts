import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { heartbeatSpy, getUserByUUID } = vi.hoisted(() => ({
    heartbeatSpy: vi.fn(),
    getUserByUUID: vi.fn(),
}));

vi.mock("../../../src/utils/websocket/websocketServerHeartbeatInterval", () => {
    return {
        heartbeat: () => heartbeatSpy,
    };
});

const userObj = {
    name: "tester",
    uuid: "uuid-1",
    timezone: "Europe/Berlin",
    location: "Berlin",
    lastState: { global: { mode: "idle", brightness: 50 } },
};

vi.mock("../../../src/db/services/db/UserService", () => {
    return {
        UserService: {
            create: vi.fn().mockResolvedValue({
                getUserByUUID,
            }),
        },
    };
});

class FakeWSS {
    clients = new Set<any>();
    handlers = new Map<string, Function>();
    on(event: string, handler: Function) {
        this.handlers.set(event, handler);
    }
    emit(event: string, ...args: any[]) {
        const h = this.handlers.get(event);
        if (h) h(...args);
    }
}

import { WebsocketServerEventHandler } from "../../../src/utils/websocket/websocketServerEventHandler";

describe("WebsocketServerEventHandler", () => {
    let wss: FakeWSS;

    beforeEach(() => {
        wss = new FakeWSS();
        heartbeatSpy.mockReset();
        getUserByUUID.mockReset();
        getUserByUUID.mockResolvedValue(userObj);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("enableConnectionEvent sets user/payload/isAlive/asyncUpdates and calls callback", async () => {
        const handler = new WebsocketServerEventHandler(wss as any);
        const cb = vi.fn();

        const done = new Promise<void>((resolve) => {
            cb.mockImplementation(() => resolve());
        });

        handler.enableConnectionEvent(cb);

        const req = { payload: { uuid: "uuid-1" } };
        const ws: any = {};

        wss.emit("connection", ws, req);

        await done;

        expect(getUserByUUID).toHaveBeenCalledWith("uuid-1");
        expect(ws.user).toEqual(userObj);
        expect(ws.payload).toEqual(req.payload);
        expect(ws.isAlive).toBe(true);
        expect(ws.asyncUpdates).toBeInstanceOf(Map);
        expect(cb).toHaveBeenCalledWith(ws, req);
    });

    it("enableHeartbeat starts interval and calls heartbeat()", () => {
        vi.useFakeTimers();
        const handler = new WebsocketServerEventHandler(wss as any);

        const id = handler.enableHeartbeat(1000);
        expect(["number", "object"]).toContain(typeof id);

        vi.advanceTimersByTime(3000);
        expect(heartbeatSpy).toHaveBeenCalledTimes(3);

        clearInterval(id);
        vi.useRealTimers();
    });

    it("enableCloseEvent registers Listener and calls callback on close", () => {
        const handler = new WebsocketServerEventHandler(wss as any);
        const cb = vi.fn();

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        handler.enableCloseEvent(cb);

        wss.emit("close");

        expect(cb).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith("WebSocket server closed");
        logSpy.mockRestore();
    });
});
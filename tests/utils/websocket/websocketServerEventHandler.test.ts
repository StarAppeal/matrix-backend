import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { WebsocketServerEventHandler } from "../../../src/utils/websocket/websocketServerEventHandler";
import type { UserService } from "../../../src/db/services/db/UserService";

const heartbeatSpy = vi.fn();
vi.mock("../../../src/utils/websocket/websocketServerHeartbeatInterval", () => ({
    heartbeat: () => heartbeatSpy,
}));

const userObj = {
    name: "tester",
    uuid: "uuid-1",
    timezone: "Europe/Berlin",
    location: "Berlin",
    lastState: { global: { mode: "idle", brightness: 50 } },
};

class FakeWSS {
    handlers = new Map<string, Function>();
    on(event: string, handler: Function) {
        this.handlers.set(event, handler);
    }
    emit(event: string, ...args: any[]) {
        this.handlers.get(event)?.(...args);
    }
}

describe("WebsocketServerEventHandler", () => {
    let wss: FakeWSS;
    let mockUserService: Mocked<UserService>; // Variable für unseren Mock-Service

    beforeEach(() => {
        wss = new FakeWSS();
        heartbeatSpy.mockClear();

        mockUserService = {
            getUserByUUID: vi.fn().mockResolvedValue(userObj),
        } as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("enableConnectionEvent sets user/payload/isAlive/asyncUpdates and calls callback", async () => {
        const handler = new WebsocketServerEventHandler(wss as any, mockUserService);
        const cb = vi.fn();

        const done = new Promise<void>((resolve) => cb.mockImplementation(() => resolve()));

        handler.enableConnectionEvent(cb);

        const req = { payload: { uuid: "uuid-1" } };
        const ws: any = {};

        wss.emit("connection", ws, req);

        await done;

        expect(mockUserService.getUserByUUID).toHaveBeenCalledWith("uuid-1");
        expect(ws.user).toEqual(userObj);
        expect(ws.payload).toEqual(req.payload);
        expect(ws.isAlive).toBe(true);
        expect(ws.asyncUpdates).toBeInstanceOf(Map);
        expect(cb).toHaveBeenCalledWith(ws, req);
    });

    it("enableHeartbeat starts interval and calls heartbeat()", () => {
        vi.useFakeTimers();
        const handler = new WebsocketServerEventHandler(wss as any, mockUserService);

        const id = handler.enableHeartbeat(1000);
        expect(["number", "object"]).toContain(typeof id);

        vi.advanceTimersByTime(3000);
        expect(heartbeatSpy).toHaveBeenCalledTimes(3);

        clearInterval(id);
        vi.useRealTimers();
    });

    it("enableCloseEvent registers Listener and calls callback on close", () => {
        const handler = new WebsocketServerEventHandler(wss as any, mockUserService);
        const cb = vi.fn();
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        handler.enableCloseEvent(cb);
        wss.emit("close");

        expect(cb).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith("WebSocket server closed");

        logSpy.mockRestore();
    });
});
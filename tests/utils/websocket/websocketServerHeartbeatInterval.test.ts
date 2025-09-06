import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {heartbeat} from "../../../src/utils/websocket/websocketServerHeartbeatInterval";

describe("heartbeat(wss)", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
        });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    function makeClient({
                            isAlive,
                            username,
                        }: {
        isAlive: boolean;
        username: string;
    }) {
        return {
            isAlive,
            payload: {username},
            ping: vi.fn(),
            terminate: vi.fn(),
        } as any;
    }

    it("terminated dead clients and pings alive ones, sets isAlive to false", () => {
        const alive = makeClient({isAlive: true, username: "alive-user"});
        const dead = makeClient({isAlive: false, username: "dead-user"});

        const wss = {
            clients: new Set<any>([alive, dead]),
        } as any;

        const hb = heartbeat(wss);
        hb();

        expect(dead.terminate).toHaveBeenCalledTimes(1);
        expect(alive.ping).toHaveBeenCalledTimes(1);
        expect(alive.isAlive).toBe(false);
    });
});
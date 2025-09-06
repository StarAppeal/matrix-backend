import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/utils/jwtAuthenticator", () => {
    return {
        JwtAuthenticator: vi.fn().mockImplementation(() => ({
            verifyToken: mockVerifyToken,
        })),
    };
});

const mockVerifyToken = vi.fn();

import type { IncomingMessage } from "node:http";
import { verifyClient } from "../../src/utils/verifyClient";

describe("verifyClient", () => {
    const cb = vi.fn();
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    function makeReq(authHeader?: string) {
        const headers: Record<string, string> = {};
        if (authHeader) headers["authorization"] = authHeader;

        // socket infos just for log
        const socket: any = { remoteAddress: "127.0.0.1", remotePort: 12345 };
        return { headers, socket } as unknown as IncomingMessage & { [k: string]: any };
    }

    beforeEach(() => {
        cb.mockReset();
        mockVerifyToken.mockReset();
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("accepts connections with valid token and sets payload", () => {
        const req = makeReq("Bearer valid.jwt");
        mockVerifyToken.mockReturnValue({ sub: "user-1" });

        verifyClient(req, cb);

        expect(mockVerifyToken).toHaveBeenCalledWith("valid.jwt");
        expect(cb).toHaveBeenCalledWith(true);
        expect((req as any).payload).toEqual({ sub: "user-1" });
    });

    it("Rejects connection if no Authorization header is set", () => {
        const req = makeReq(undefined);
        mockVerifyToken.mockReturnValue(null);

        verifyClient(req, cb);

        expect(cb).toHaveBeenCalledWith(false, 401, "Unauthorized");
        expect(consoleSpy).toHaveBeenCalled();
    });

    it("rejects connection, if token is invalid", () => {
        const req = makeReq("Bearer bad.jwt");
        mockVerifyToken.mockReturnValue(null);

        verifyClient(req, cb);

        expect(mockVerifyToken).toHaveBeenCalledWith("bad.jwt");
        expect(cb).toHaveBeenCalledWith(false, 401, "Unauthorized");
    });

    it("extracts token correctly after 'Bearer ' prefix", () => {
        const expectedToken = "   fancy.token.with.spaces  ";
        const req = makeReq(`Bearer ${expectedToken}`);
        mockVerifyToken.mockReturnValue({ ok: true });

        verifyClient(req, cb);

        expect(mockVerifyToken).toHaveBeenCalledWith(expectedToken);
        expect(cb).toHaveBeenCalledWith(true);
    });
});
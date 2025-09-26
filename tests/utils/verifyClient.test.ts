import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from "vitest";

import type { IncomingMessage } from "node:http";
import { verifyClient } from "../../src/utils/verifyClient";
import { JwtAuthenticator } from "../../src/utils/jwtAuthenticator";
// @ts-ignore
import { createMockJwtAuthenticator } from "../helpers/testSetup";
import logger from "../../src/utils/logger";

vi.mock("../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("verifyClient", () => {
    const payload = { id: "user-1", username: "hi", uuid: "1234" };
    const cb = vi.fn();

    let mockJwtAuthenticator: Mocked<JwtAuthenticator>;

    function makeReq(authHeader?: string) {
        const headers: Record<string, string> = {};
        if (authHeader) headers["authorization"] = authHeader;

        const socket: any = { remoteAddress: "127.0.0.1", remotePort: 12345 };
        return { headers, socket } as unknown as IncomingMessage & { [k: string]: any };
    }

    beforeEach(() => {
        cb.mockReset();
        mockJwtAuthenticator = createMockJwtAuthenticator() as any;
    });

    it("accepts connections with valid token and sets payload", () => {
        const req = makeReq("Bearer valid.jwt");
        mockJwtAuthenticator.verifyToken.mockReturnValue(payload);

        verifyClient(req, mockJwtAuthenticator, cb);

        expect(mockJwtAuthenticator.verifyToken).toHaveBeenCalledWith("valid.jwt");
        expect(cb).toHaveBeenCalledWith(true);
        expect((req as any).payload).toEqual(payload);
    });

    it("Rejects connection if no Authorization header is set", () => {
        const req = makeReq(undefined);
        mockJwtAuthenticator.verifyToken.mockReturnValue(null);

        verifyClient(req, mockJwtAuthenticator, cb);

        expect(cb).toHaveBeenCalledWith(false, 401, "Unauthorized");
        expect(logger.warn).toHaveBeenCalled();
    });

    it("rejects connection, if token is invalid", () => {
        const req = makeReq("Bearer bad.jwt");
        mockJwtAuthenticator.verifyToken.mockReturnValue(null);

        verifyClient(req, mockJwtAuthenticator, cb);

        expect(mockJwtAuthenticator.verifyToken).toHaveBeenCalledWith("bad.jwt");
        expect(cb).toHaveBeenCalledWith(false, 401, "Unauthorized");
    });

    it("extracts token correctly after 'Bearer ' prefix", () => {
        const expectedToken = "   fancy.token.with.spaces  ";
        const req = makeReq(`Bearer ${expectedToken}`);
        mockJwtAuthenticator.verifyToken.mockReturnValue(payload);

        verifyClient(req, mockJwtAuthenticator, cb);

        expect(mockJwtAuthenticator.verifyToken).toHaveBeenCalledWith(expectedToken);
        expect(cb).toHaveBeenCalledWith(true);
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("jsonwebtoken", () => {
    return {
        default: {
            verify: vi.fn(),
            sign: vi.fn(),
        },
    };
});

vi.mock("../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import jwt from "jsonwebtoken";
import { JwtAuthenticator } from "../../src/utils/jwtAuthenticator";
import logger from "../../src/utils/logger";

describe("JwtAuthenticator", () => {
    const secret = "test-secret";
    let auth: JwtAuthenticator;

    beforeEach(() => {
        auth = new JwtAuthenticator(secret);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("verifyToken returns null when no token is passed", () => {
        expect(auth.verifyToken(undefined)).toBeNull();
        expect(jwt.verify).not.toHaveBeenCalled();
    });

    it("verifyToken returns DecodedToken when verify was successful ", () => {
        const payload = { username: "alice", id: "1", uuid: "u-1" };
        (jwt.verify as any).mockReturnValue(payload);

        const res = auth.verifyToken("valid.jwt.token");
        expect(jwt.verify).toHaveBeenCalledWith("valid.jwt.token", secret);
        expect(res).toEqual(payload);
    });

    it("verifyToken returns null when verify throws error", () => {
        (jwt.verify as any).mockImplementation(() => {
            throw new Error("invalid");
        });

        const res = auth.verifyToken("broken.token");
        expect(res).toBeNull();
        expect(logger.error).toHaveBeenCalled();
    });

    it("generateToken signs payload with secret", () => {
        (jwt.sign as any).mockReturnValue("signed.jwt");
        const payload = { username: "bob" } as any;

        const token = auth.generateToken(payload);
        expect(jwt.sign).toHaveBeenCalledWith(payload, secret);
        expect(token).toBe("signed.jwt");
    });
});

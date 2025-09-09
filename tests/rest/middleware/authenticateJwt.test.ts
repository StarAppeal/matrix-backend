import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { Request, Response, NextFunction } from "express";

import { authenticateJwt } from "../../../src/rest/middleware/authenticateJwt";
import { JwtAuthenticator } from "../../../src/utils/jwtAuthenticator";
import { createMockJwtAuthenticator } from "../../helpers/testSetup";

vi.mock("../../../src/utils/jwtAuthenticator");

describe("authenticateJwt middleware", () => {
    let mockJwtInstance: ReturnType<typeof createMockJwtAuthenticator>;
    let req: Mocked<Request>;
    let res: Mocked<Response>;
    let next: Mocked<NextFunction>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('SECRET_KEY', 'test-secret-key');

        mockJwtInstance = createMockJwtAuthenticator();

        vi.mocked(JwtAuthenticator).mockImplementation(() => mockJwtInstance as any);

        req = { headers: {} } as Mocked<Request>;
        res = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        } as unknown as Mocked<Response>;
        next = vi.fn();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("Success Scenarios", () => {
        it("should authenticate a valid token, set req.payload, and call next", () => {
            const mockPayload = { uuid: "test-uuid-123" };
            req.headers.authorization = "Bearer valid-jwt-token";
            mockJwtInstance.verifyToken.mockReturnValue(mockPayload);

            authenticateJwt(req, res, next);

            expect(vi.mocked(JwtAuthenticator)).toHaveBeenCalledWith("test-secret-key");
            expect(mockJwtInstance.verifyToken).toHaveBeenCalledWith("valid-jwt-token");
            expect(req.payload).toEqual(mockPayload);
            expect(next).toHaveBeenCalledOnce();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe("Failure Scenarios", () => {
        it.each([
            { description: "no authorization header", authHeader: undefined, expectedToken: undefined },
            { description: "empty authorization header", authHeader: "", expectedToken: "" },
            { description: "header with only 'Bearer '", authHeader: "Bearer ", expectedToken: "" },
            { description: "an invalid/expired token", authHeader: "Bearer invalid-token", expectedToken: "invalid-token" },
        ])("should return 401 Unauthorized when there is $description", ({ authHeader, expectedToken }) => {
            req.headers.authorization = authHeader;
            mockJwtInstance.verifyToken.mockReturnValue(null); // Alle Fehlerfälle führen zu null

            authenticateJwt(req, res, next);

            expect(mockJwtInstance.verifyToken).toHaveBeenCalledWith(expectedToken);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith("Unauthorized");
            expect(next).not.toHaveBeenCalled();
        });
    });
});
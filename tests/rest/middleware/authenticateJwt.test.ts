import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { Request, Response, NextFunction } from "express";

import { authenticateJwt } from "../../../src/rest/middleware/authenticateJwt";
import { createMockJwtAuthenticator } from "../../helpers/testSetup";

vi.mock("../../../src/utils/jwtAuthenticator");


describe("authenticateJwt middleware", () => {
    let mockJwtInstance: ReturnType<typeof createMockJwtAuthenticator>;
    let req: Mocked<Request>;
    let res: Mocked<Response>;
    let next: Mocked<NextFunction>;
    let _authenticateJwt: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockJwtInstance = createMockJwtAuthenticator();

        // @ts-ignore
        _authenticateJwt = authenticateJwt(mockJwtInstance);

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

            _authenticateJwt(req, res, next);

            expect(mockJwtInstance.verifyToken).toHaveBeenCalledWith("valid-jwt-token");
            expect(req.payload).toEqual(mockPayload);
            expect(next).toHaveBeenCalledOnce();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe("Failure Scenarios", () => {
        it.each([
            { description: "no authorization header", authHeader: undefined, errorMessage: "Unauthorized: No Authorization header provided" },
            { description: "empty authorization header", authHeader: "", errorMessage: "Unauthorized: No Authorization header provided" },
            { description: "header with only 'Bearer '", authHeader: "Bearer ", errorMessage: "Unauthorized: Token is missing" },
            { description: "an invalid/expired token", authHeader: "Bearer invalid-token", errorMessage: "Unauthorized: Invalid token", callVerifyToken: true },
        ])("should return 401 Unauthorized when there is $description", ({ authHeader, errorMessage, callVerifyToken }) => {
            req.headers.authorization = authHeader;
            mockJwtInstance.verifyToken.mockReturnValue(null);

            _authenticateJwt(req, res, next);

            const expected = { ok: false, data: {details: undefined, message: errorMessage}}

            if (!callVerifyToken) {
                expect(mockJwtInstance.verifyToken).not.toHaveBeenCalled();
            } else {
                expect(mockJwtInstance.verifyToken).toHaveBeenCalled();
            }
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.send).toHaveBeenCalledWith(expected);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateJwt } from "../../../src/rest/middleware/authenticateJwt";
import { JwtAuthenticator } from "../../../src/utils/jwtAuthenticator";

vi.mock("../../../src/utils/jwtAuthenticator", () => ({
  JwtAuthenticator: vi.fn().mockImplementation(() => ({
    verifyToken: vi.fn(),
  })),
}));

const MockedJwtAuthenticator = vi.mocked(JwtAuthenticator);

vi.stubGlobal("process", {
  env: {
    SECRET_KEY: "test-secret-key",
  },
});

describe("authenticateJwt middleware", () => {
  let mockJwtAuthenticatorInstance: any;
  let req: any;
  let res: any;
  let next: any;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwtAuthenticatorInstance = {
      verifyToken: vi.fn(),
    };
    MockedJwtAuthenticator.mockReturnValue(mockJwtAuthenticatorInstance);

    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    req = {
      headers: {},
      payload: undefined,
    };

    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  describe("successful authentication", () => {
    it("should authenticate valid JWT token and set payload", () => {
      const mockPayload = {
        uuid: "test-uuid-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      req.headers.authorization = "Bearer valid-jwt-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(mockPayload);

      authenticateJwt(req, res, next);

      expect(MockedJwtAuthenticator).toHaveBeenCalledWith("test-secret-key");
      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("valid-jwt-token");
      expect(consoleSpy).toHaveBeenCalledWith(mockPayload);
      expect(req.payload).toEqual(mockPayload);
      expect(next).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it("should work with different authorization header formats", () => {
      const mockPayload = { uuid: "test-uuid-456" };

      req.headers.authorization = "bearer another-valid-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(mockPayload);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("another-valid-token");
      expect(req.payload).toEqual(mockPayload);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("missing authorization header", () => {
    it("should return 401 when no authorization header is provided", () => {
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith(undefined);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
      expect(req.payload).toBeUndefined();
    });

    it("should return 401 when authorization header is empty", () => {
      req.headers.authorization = "";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("invalid authorization header format", () => {
    it("should return 401 when authorization header doesn't start with Bearer", () => {
      req.headers.authorization = "Bearer whatever-auth";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("whatever-auth");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header has no token", () => {
      req.headers.authorization = "Bearer";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when authorization header has only Bearer with space", () => {
      req.headers.authorization = "Bearer ";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("JWT verification errors", () => {
    it("should return 401 when JWT is invalid", () => {
      req.headers.authorization = "Bearer invalid-jwt-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("invalid-jwt-token");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when JWT is expired", () => {
      req.headers.authorization = "Bearer expired-jwt-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith("Unauthorized");
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when JWT signature is invalid", () => {
      req.headers.authorization = "Bearer tampered-jwt-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(null);

      authenticateJwt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });





  describe("environment configuration", () => {
    it("should use SECRET_KEY from environment", () => {
      const mockPayload = { uuid: "test-uuid" };

      req.headers.authorization = "Bearer test-token";
      mockJwtAuthenticatorInstance.verifyToken.mockReturnValue(mockPayload);

      authenticateJwt(req, res, next);

      expect(MockedJwtAuthenticator).toHaveBeenCalledWith("test-secret-key");
      expect(mockJwtAuthenticatorInstance.verifyToken).toHaveBeenCalledWith("test-token");
      expect(req.payload).toEqual(mockPayload);
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
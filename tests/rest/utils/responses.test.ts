import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  internalError,
} from "../../../src/rest/utils/responses";

function createMockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe("Response Utilities", () => {
  describe("ok", () => {
    it("should return 200 status with success response", () => {
      const res = createMockResponse();
      const data = { message: "Success" };

      ok(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        data,
      });
    });

    it("should handle null data", () => {
      const res = createMockResponse();
      const data = null;

      ok(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        data: null,
      });
    });

    it("should handle complex data objects", () => {
      const res = createMockResponse();
      const data = {
        users: [{ id: 1, name: "John" }, { id: 2, name: "Jane" }],
        pagination: { page: 1, total: 2 },
      };

      ok(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        data,
      });
    });
  });

  describe("created", () => {
    it("should return 201 status with success response", () => {
      const res = createMockResponse();
      const data = { id: 1, name: "New User" };

      created(res, data);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        data,
      });
    });
  });

  describe("badRequest", () => {
    it("should return 400 status with default message", () => {
      const res = createMockResponse();

      badRequest(res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Bad Request",
          details: undefined,
        },
      });
    });

    it("should return 400 status with custom message and details", () => {
      const res = createMockResponse();
      const message = "Invalid input";
      const details = ["Field 'name' is required", "Field 'email' must be valid"];

      badRequest(res, message, details);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details,
        },
      });
    });
  });

  describe("unauthorized", () => {
    it("should return 401 status with default message", () => {
      const res = createMockResponse();

      unauthorized(res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Unauthorized",
          details: undefined,
        },
      });
    });

    it("should return 401 status with custom message and details", () => {
      const res = createMockResponse();
      const message = "Invalid token";
      const details = { tokenExpired: true };

      unauthorized(res, message, details);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details,
        },
      });
    });
  });

  describe("forbidden", () => {
    it("should return 403 status with default message", () => {
      const res = createMockResponse();

      forbidden(res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Forbidden",
          details: undefined,
        },
      });
    });

    it("should return 403 status with custom message", () => {
      const res = createMockResponse();
      const message = "Insufficient permissions";

      forbidden(res, message);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details: undefined,
        },
      });
    });
  });

  describe("notFound", () => {
    it("should return 404 status with default message", () => {
      const res = createMockResponse();

      notFound(res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Not Found",
          details: undefined,
        },
      });
    });

    it("should return 404 status with custom message and details", () => {
      const res = createMockResponse();
      const message = "User not found";
      const details = { userId: "123" };

      notFound(res, message, details);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details,
        },
      });
    });
  });

  describe("conflict", () => {
    it("should return 409 status with default message", () => {
      const res = createMockResponse();

      conflict(res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Conflict",
          details: undefined,
        },
      });
    });

    it("should return 409 status with custom message", () => {
      const res = createMockResponse();
      const message = "User already exists";

      conflict(res, message);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details: undefined,
        },
      });
    });
  });

  describe("tooManyRequests", () => {
    it("should return 429 status with default message", () => {
      const res = createMockResponse();

      tooManyRequests(res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Too Many Requests",
          details: undefined,
        },
      });
    });

    it("should return 429 status with custom message and details", () => {
      const res = createMockResponse();
      const message = "Rate limit exceeded";
      const details = { retryAfter: 60 };

      tooManyRequests(res, message, details);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details,
        },
      });
    });
  });

  describe("internalError", () => {
    it("should return 500 status with default message", () => {
      const res = createMockResponse();

      internalError(res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message: "Internal Server Error",
          details: undefined,
        },
      });
    });

    it("should return 500 status with custom message and details", () => {
      const res = createMockResponse();
      const message = "Database connection failed";
      const details = { error: "Connection timeout" };

      internalError(res, message, details);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        ok: false,
        data: {
          message,
          details,
        },
      });
    });
  });

  describe("Response chaining", () => {
    it("should return the response object for method chaining", () => {
      const res = createMockResponse();
      const data = { test: "data" };

      const result = ok(res, data);

      expect(result).toBe(res);
    });

    it("should work with error responses for chaining", () => {
      const res = createMockResponse();

      const result = badRequest(res, "Test error");

      expect(result).toBe(res);
    });
  });
});
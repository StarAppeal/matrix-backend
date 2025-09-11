import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import {cookieJwtAuth} from "../../../src/rest/middleware/cookieAuth";

describe("cookieJwtAuth Middleware", () => {
    it("should do nothing if Authorization header already exists", () => {
        const req = {
            headers: {
                authorization: "Bearer existing-token",
            },
            cookies: {
                "auth-token": "some-cookie-token",
            },
        } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        cookieJwtAuth(req, res, next);

        expect(req.headers.authorization).toBe("Bearer existing-token");
        expect(next).toHaveBeenCalledOnce();
    });

    it("should add Authorization header if it is missing but cookie exists", () => {
        const req = {
            headers: {},
            cookies: {
                "auth-token": "my-secret-cookie-token",
            },
        } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        cookieJwtAuth(req, res, next);

        expect(req.headers.authorization).toBe("Bearer my-secret-cookie-token");
        expect(next).toHaveBeenCalledOnce();
    });

    it("should do nothing if neither Authorization header nor cookie exist", () => {
        const req = {
            headers: {},
            cookies: {},
        } as unknown as Request;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        cookieJwtAuth(req, res, next);

        expect(req.headers.authorization).toBeUndefined();
        expect(next).toHaveBeenCalledOnce();
    });
});
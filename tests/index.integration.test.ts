import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import http from "http";
import { authLimiter } from "../src/rest/middleware/rateLimit";

vi.mock("../src/db/services/db/database.service", () => ({
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/websocket", () => ({
    ExtendedWebSocketServer: vi.fn(),
}));

vi.mock("../src/config", () => ({
    config: {
        port: 3001,
        cors: { origin: "http://test-origin.com", credentials: true },
    },
}));

vi.mock("../src/rest/middleware/rateLimit", async (importOriginal) => {
    const original = await importOriginal<typeof import("../src/rest/middleware/rateLimit")>();
    return {
        ...original,
        authLimiter: vi.fn((req, res, next) => next()),
        spotifyLimiter: vi.fn((req, res, next) => next()),
    };
});

let app: express.Application;
let server: http.Server;

beforeAll(async () => {
    const { startServer } = await import("../src/index");

    const instances = await startServer();
    app = instances.app;
    server = instances.server;
});

afterAll(async () => {
    await new Promise<void>((resolve) => {
        if (server) {
            server.close(() => resolve());
        } else {
            resolve();
        }
    });
});

describe("Express App Integration Test", () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should start and respond to the healthz endpoint", async () => {
        const response = await request(app).get("/api/healthz").expect(200);
        expect(response.body).toEqual({ status: "ok" });
    });

    it("should apply CORS headers based on the configuration", async () => {
        const response = await request(app)
            .options("/api/healthz")
            .set("Origin", "http://test-origin.com")
            .expect(204);

        expect(response.headers['access-control-allow-origin']).toBe("http://test-origin.com");
        expect(response.headers['access-control-allow-credentials']).toBe("true");
    });

    it("should apply security headers to responses", async () => {
        const response = await request(app).get("/api/healthz").expect(200);
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
    });

    it("should protect a route with authentication middleware", async () => {
        await request(app).get("/api/user/me").expect(401);
    });

    it("should apply the auth rate limiter to an auth route", async () => {
        await request(app).post("/api/auth/login").send({});
        expect(authLimiter).toHaveBeenCalledOnce();
    });

    it("should NOT apply the auth rate limiter to a non-auth route", async () => {
        await request(app).get("/api/healthz").expect(200);
        expect(authLimiter).not.toHaveBeenCalled();
    });

    it("should return a 404 for an unknown route", async () => {
        await request(app).get("/api/this-route-does-not-exist").expect(404);
    });
});
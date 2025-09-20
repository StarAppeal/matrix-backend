import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { Server } from "../src/server";
import { Router, type Request, type Response, type NextFunction } from "express"; // Import Express types
import type { Express } from "express";
import { authLimiter } from "../src/rest/middleware/rateLimit";

vi.mock("../src/services/db/database.service", () => ({
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
    disconnectFromDatabase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/services/db/UserService", () => ({
    UserService: { create: vi.fn().mockResolvedValue({}) },
}));
vi.mock("../src/services/spotifyTokenService", () => ({ SpotifyTokenService: vi.fn() }));

vi.mock("../src/websocket", () => ({
    ExtendedWebSocketServer: vi.fn().mockImplementation(() => {
        return {};
    }),
}));

vi.mock("../src/rest/middleware/rateLimit", async (importOriginal) => {
    const original = await importOriginal<typeof import("../src/rest/middleware/rateLimit")>();
    return {
        ...original,
        authLimiter: vi.fn((req: Request, res: Response, next: NextFunction) => next()),
        spotifyLimiter: vi.fn((req: Request, res: Response, next: NextFunction) => next()),
    };
});

vi.mock("../src/rest/middleware/authenticateJwt", () => ({
    authenticateJwt: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        res.status(401).json({ error: "Unauthorized" });
    }),
}));

vi.mock("../src/rest/auth", () => {
    const MockRestAuth = vi.fn().mockImplementation(() => {
        return {
            createRouter: () => {
                const router = Router();
                router.get("/test-500-error", (_req, _res, _next) => {
                    throw new Error("Simulated internal server error!");
                });
                router.get("/test-400-error", (_req, _res, next) => {
                    const clientError: Error & { status?: number } = new Error("Simulated client error.");
                    clientError.status = 400;
                    next(clientError);
                });
                router.post("/login", (req, res) => res.status(200).send("ok"));
                return router;
            }
        };
    });
    return { RestAuth: MockRestAuth };
});

const mockServerConfig = {
    port: 8888,
    jwtSecret: "a-very-secure-test-secret-that-is-at-least-32-chars-long",
    spotifyClientId: "test-id",
    spotifyClientSecret: "test-secret",
    cors: {
        origin: "http://test-origin.com",
        credentials: true,
    },
};

describe("Server Class Integration Tests", () => {
    let server: Server;
    let app: Express;

    beforeEach(async () => {
        vi.clearAllMocks();
        server = new Server(mockServerConfig);
        await server.start();
        app = server.app;
    });

    afterEach(async () => {
        await server.stop();
    });

    describe("Server Setup and Middleware", () => {
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

        it("should apply the auth rate limiter to an auth route", async () => {
            await request(app).post("/api/auth/login").send({});
            expect(authLimiter).toHaveBeenCalledOnce();
        });

        it("should NOT apply the auth rate limiter to a non-auth route", async () => {
            await request(app).get("/api/healthz").expect(200);
            expect(authLimiter).not.toHaveBeenCalled();
        });
    });

    describe("Routing and Authentication", () => {
        it("should protect a route with authentication middleware", async () => {
            // The default mock for authenticateJwt returns 401, so this should fail as expected
            await request(app).get("/api/user").expect(401);
        });

        it("should return a 404 for an unknown route", async () => {
            await request(app).get("/api/this-route-does-not-exist").expect(404);
        });
    });

    describe("Error Handling Middleware", () => {
        it("should handle a 500 internal server error and return a generic message with an errorId", async () => {
            const response = await request(app)
                .get("/api/auth/test-500-error")
                .expect(500);

            expect(response.body.ok).toBe(false);
            expect(response.body.data.error).toBe("An unexpected error occurred on the server.");
            expect(response.body.data.errorId).toBeDefined();
            expect(typeof response.body.data.errorId).toBe("string");
        });

        it("should handle a 400 client error and return the specific message without an errorId", async () => {
            const response = await request(app)
                .get("/api/auth/test-400-error")
                .expect(400);

            expect(response.body.ok).toBe(false);
            expect(response.body.data.error).toBe("Simulated client error.");
            expect(response.body.data.errorId).toBeUndefined();
        });
    });
});
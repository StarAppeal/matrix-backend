import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { authLimiter, weatherLimiter } from "../../../src/rest/middleware/rateLimit";

function createTestApp() {
    const app = express();
    app.set("trust proxy", 1);
    app.get("/auth-test", authLimiter, (_req, res) => res.status(200).send({ ok: true }));
    app.get("/weather-test", weatherLimiter, (_req, res) => res.status(200).send({ ok: true }));
    return app;
}

async function hit(app: express.Express, path: string, times: number) {
    for (let i = 0; i < times; i++) {
        await request(app).get(path);
    }
}

describe("RateLimit", () => {
    it("limits /auth-test after 30 Requests, returns http 429", async () => {
        const app = createTestApp();

        // 30 are allowed
        await hit(app, "/auth-test", 30);

        // afterwards, any request returns 429
        const res = await request(app).get("/auth-test");
        expect(res.status).toBe(429);

        expect(res.headers["ratelimit-policy"]).toBeTruthy();
    });

    it("limits /weather-test after 25 requests, returns http 429", async () => {
        const app = createTestApp();

        await hit(app, "/weather-test", 25);

        const res = await request(app).get("/weather-test");
        expect(res.status).toBe(429);
        expect(res.headers["ratelimit-policy"]).toBeTruthy();
    });
});
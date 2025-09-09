import { describe, it, expect, afterEach, vi } from "vitest";

const loadConfigWithEnv = async (envVars: Record<string, string | undefined>) => {
    for (const key in envVars) {
        vi.stubEnv(key, envVars[key] as string);
    }
    const { config } = await import("../src/config");
    return config;
};

describe("config.ts", () => {
    afterEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    describe("PORT configuration", () => {
        const requiredEnv = { FRONTEND_URL: "http://localhost:3000" };

        it("should default to 3000 if PORT is not set", async () => {
            const config = await loadConfigWithEnv({ ...requiredEnv, PORT: undefined });
            expect(config.port).toBe(3000);
        });

        it("should parse a valid PORT from the environment", async () => {
            const config = await loadConfigWithEnv({ ...requiredEnv, PORT: "8080" });
            expect(config.port).toBe(8080);
        });

        it.each([
            { case: "not a number", value: "abc" },
            { case: "a negative number", value: "-100" },
            { case: "zero", value: "0" },
            { case: "Infinity", value: "Infinity" },
        ])("should throw an error if PORT is $case", async ({ value }) => {
            const load = () => loadConfigWithEnv({ ...requiredEnv, PORT: value });
            await expect(load).rejects.toThrow("Env var PORT must be a positive number");
        });
    });

    describe("CORS Origin (FRONTEND_URL) configuration", () => {
        it.each([
            { case: "a valid HTTP URL", value: "http://localhost:3000" },
            { case: "a valid HTTPS URL", value: "https://example.com" },
            { case: "a URL with a path", value: "https://example.com/app/path" },
        ])("should accept $case", async ({ value }) => {
            const config = await loadConfigWithEnv({ FRONTEND_URL: value });
            expect(config.cors.origin).toBe(value);
        });

        it.each([
            { case: "undefined", value: undefined, error: "Missing required env var: FRONTEND_URL" },
            { case: "an empty string", value: "", error: "Missing required env var: FRONTEND_URL" },
            { case: "only whitespace", value: "   ", error: "Missing required env var: FRONTEND_URL" },
            { case: "not a valid URL", value: "not-a-url", error: "FRONTEND_URL must be a valid URL" },
        ])("should throw an error if FRONTEND_URL is $case", async ({ value, error }) => {
            const load = () => loadConfigWithEnv({ FRONTEND_URL: value });
            await expect(load).rejects.toThrow(error);
        });
    });

    describe("Overall Config Object", () => {
        it("should create a complete config object with default values", async () => {
            const config = await loadConfigWithEnv({
                FRONTEND_URL: "http://localhost:3000",
                NODE_ENV: undefined,
                PORT: undefined,
            });

            expect(config).toEqual({
                env: "development",
                port: 3000,
                cors: {
                    origin: "http://localhost:3000",
                    credentials: true,
                },
            });
        });

        it("should create a config object with all custom values", async () => {
            const config = await loadConfigWithEnv({
                FRONTEND_URL: "https://myapp.com",
                NODE_ENV: "production",
                PORT: "9999",
            });

            expect(config).toEqual({
                env: "production",
                port: 9999,
                cors: {
                    origin: "https://myapp.com",
                    credentials: true,
                },
            });
        });
    });
});
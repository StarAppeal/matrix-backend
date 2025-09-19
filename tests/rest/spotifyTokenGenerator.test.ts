import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import { SpotifyTokenGenerator } from "../../src/rest/spotifyTokenGenerator";
import { SpotifyTokenService } from "../../src/db/services/spotifyTokenService";
import { createTestApp, createMockSpotifyTokenService } from "../helpers/testSetup";

vi.mock("../../src/db/services/spotifyTokenService");

describe("SpotifyTokenGenerator", () => {
    let app: express.Application;
    let mockTokenService: ReturnType<typeof createMockSpotifyTokenService>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockTokenService = createMockSpotifyTokenService();

        const spotifyGenerator = new SpotifyTokenGenerator(mockTokenService as any);
        app = createTestApp(spotifyGenerator.createRouter(), "/spotify");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("POST /token/refresh", () => {
        const validRefreshData = { refreshToken: "valid-refresh-token-123" };

        it("should refresh token successfully", async () => {
            const mockTokenResponse = { access_token: "new-access-token" };
            mockTokenService.refreshToken.mockResolvedValue(mockTokenResponse);

            const response = await request(app).post("/spotify/token/refresh").send(validRefreshData).expect(200);

            expect(response.body.data.token).toEqual(mockTokenResponse);
            expect(mockTokenService.refreshToken).toHaveBeenCalledWith("valid-refresh-token-123");
        });

        it("should handle token service errors", async () => {
            mockTokenService.refreshToken.mockRejectedValue(new Error("Spotify API error"));
            const response = await request(app).post("/spotify/token/refresh").send(validRefreshData).expect(500);
            expect(response.body.data.message).toBe("Failed to handle spotify token request");
        });

        it.each([
            { description: "missing refreshToken", body: {}, expectedError: "refreshToken" },
            { description: "empty refreshToken", body: { refreshToken: "" }, expectedError: "refreshToken" },
            { description: "non-string refreshToken", body: { refreshToken: 123 }, expectedError: "refreshToken" },
        ])("should return bad request for $description", async ({ body, expectedError }) => {
            const response = await request(app).post("/spotify/token/refresh").send(body).expect(400);
            expect(response.body.data.details[0]).toContain(expectedError);
            expect(mockTokenService.refreshToken).not.toHaveBeenCalled();
        });
    });

    describe("POST /token/generate", () => {
        const validGenerateData = { authCode: "valid-auth-code", redirectUri: "http://localhost:3000/callback" };

        it("should generate token successfully", async () => {
            const mockTokenResponse = { access_token: "generated-access-token" };
            mockTokenService.generateToken.mockResolvedValue(mockTokenResponse);

            const response = await request(app).post("/spotify/token/generate").send(validGenerateData).expect(200);

            expect(response.body.data.token).toEqual(mockTokenResponse);
            expect(mockTokenService.generateToken).toHaveBeenCalledWith(validGenerateData.authCode, validGenerateData.redirectUri);
        });

        it("should handle token service errors", async () => {
            mockTokenService.generateToken.mockRejectedValue(new Error("Invalid auth code"));
            const response = await request(app).post("/spotify/token/generate").send(validGenerateData).expect(500);
            expect(response.body.data.message).toBe("Failed to handle spotify token request");
        });

        it.each([
            { description: "missing authCode", body: { redirectUri: "http://uri" }, expectedError: "authCode" },
            { description: "missing redirectUri", body: { authCode: "code" }, expectedError: "redirectUri" },
            { description: "empty authCode", body: { authCode: "", redirectUri: "http://uri" }, expectedError: "authCode" },
            { description: "invalid redirectUri", body: { authCode: "code", redirectUri: "not-a-url" }, expectedError: "redirectUri" },
        ])("should return bad request for $description", async ({ body, expectedError }) => {
            const response = await request(app).post("/spotify/token/generate").send(body).expect(400);
            expect(response.body.data.details[0]).toContain(expectedError);
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });
    });
});
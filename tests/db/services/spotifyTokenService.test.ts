import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import type { SpotifyTokenService as SpotifyTokenServiceType } from "../../../src/db/services/spotifyTokenService";
import type { OAuthTokenResponse } from "../../../src/interfaces/OAuthTokenResponse";

vi.mock("axios");
const mockedAxiosPost = vi.mocked(axios.post);

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
});

describe("SpotifyTokenService - Successful Initialization", () => {
    let spotifyTokenService: SpotifyTokenServiceType;

    beforeEach(async () => {
        const { SpotifyTokenService } = await import("../../../src/db/services/spotifyTokenService");
        spotifyTokenService = new SpotifyTokenService("test-client-id","test-client-secret");
    });

    const getExpectedAuthHeader = () => {
        const credentials = `test-client-id:test-client-secret`;
        return `Basic ${Buffer.from(credentials).toString("base64")}`;
    };

    describe("refreshToken", () => {
        it("should call the Spotify API with the correct parameters and return the data", async () => {
            const refreshToken = "test-refresh-token";
            const mockResponse = { access_token: "new-access-token" } as OAuthTokenResponse;
            mockedAxiosPost.mockResolvedValue({ data: mockResponse });

            const result = await spotifyTokenService.refreshToken(refreshToken);

            expect(result).toEqual(mockResponse);
            expect(mockedAxiosPost).toHaveBeenCalledWith(
                SPOTIFY_TOKEN_URL,
                `grant_type=refresh_token&refresh_token=${refreshToken}`,
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": getExpectedAuthHeader(),
                    },
                }
            );
        });

        it("should propagate errors from the Spotify API", async () => {
            const apiError = new Error("Invalid refresh token");
            mockedAxiosPost.mockRejectedValue(apiError);
            await expect(spotifyTokenService.refreshToken("invalid-token")).rejects.toThrow(apiError);
        });
    });

    describe("generateToken", () => {
        it("should call the Spotify API with the correct parameters and return the data", async () => {
            const authCode = "test-auth-code";
            const redirectUri = "http://localhost:3000/callback";
            const mockResponse = { access_token: "new-access-token" } as OAuthTokenResponse;
            mockedAxiosPost.mockResolvedValue({ data: mockResponse });

            const result = await spotifyTokenService.generateToken(authCode, redirectUri);

            expect(result).toEqual(mockResponse);
            expect(mockedAxiosPost).toHaveBeenCalledWith(
                SPOTIFY_TOKEN_URL,
                `grant_type=authorization_code&code=${authCode}&redirect_uri=${redirectUri}`,
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Authorization": getExpectedAuthHeader(),
                    },
                }
            );
        });

        it("should propagate errors from the Spotify API", async () => {
            const apiError = new Error("Invalid auth code");
            mockedAxiosPost.mockRejectedValue(apiError);
            await expect(spotifyTokenService.generateToken("invalid-code", "uri")).rejects.toThrow(apiError);
        });
    });
});
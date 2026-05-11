import { describe, it, expect, vi, beforeEach } from "vitest";
import { LastFmApiService } from "../../src/services/lastFmApiService";
import logger from "../../src/utils/logger";
import { HttpClient } from "../../src/utils/httpClient";

vi.mock("../../src/utils/logger", () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    },
}));

describe("LastFmApiService", () => {
    let lastFmApiService: LastFmApiService;
    const mockApiKey = "mockApiKey";

    const mockHttpClient = {
        get: vi.fn(),
    } as unknown as HttpClient;

    beforeEach(() => {
        vi.clearAllMocks();
        lastFmApiService = new LastFmApiService(mockApiKey, mockHttpClient);
    });

    describe("getCurrentlyPlaying", () => {
        const username = "testUser";

        it("should return currently playing track data when a track is playing", async () => {
            const mockLastFmResponse = {
                recenttracks: {
                    track: [
                        {
                            name: "Test Song",
                            artist: { "#text": "Test Artist" },
                            image: [
                                { "#text": "small.jpg" },
                                { "#text": "medium.jpg" },
                                { "#text": "large.jpg" },
                                { "#text": "extralarge.jpg" },
                            ],
                            "@attr": { nowplaying: "true" },
                        },
                    ],
                },
            };

            vi.mocked(mockHttpClient.get).mockResolvedValue(mockLastFmResponse);

            const result = await lastFmApiService.getCurrentlyPlaying(username);

            expect(mockHttpClient.get).toHaveBeenCalledWith("", {
                params: {
                    method: "user.getrecenttracks",
                    user: username,
                    api_key: mockApiKey,
                    format: "json",
                    limit: 1,
                },
            });

            expect(result).toEqual({
                isPlaying: true,
                title: "Test Song",
                artist: "Test Artist",
                imageUrl: "extralarge.jpg",
            });
        });

        it("should return isPlaying: false when the latest track is NOT playing right now", async () => {
            const mockLastFmResponse = {
                recenttracks: {
                    track: [
                        {
                            name: "Old Song",
                            artist: { "#text": "Old Artist" },
                            image: [{}, {}, {}, {}],
                        },
                    ],
                },
            };

            vi.mocked(mockHttpClient.get).mockResolvedValue(mockLastFmResponse);

            const result = await lastFmApiService.getCurrentlyPlaying(username);

            expect(result).toEqual({ isPlaying: false });
        });

        it("should return isPlaying: false and log an error if Axios throws", async () => {
            vi.mocked(mockHttpClient.get).mockRejectedValue(new Error("Network Error"));

            const result = await lastFmApiService.getCurrentlyPlaying(username);

            expect(result).toEqual({ isPlaying: false });
            expect(logger.error).toHaveBeenCalledWith(`Last.fm API Error for user ${username}:`, expect.any(Error));
        });
    });

    describe("validateUsername", () => {
        const username = "testUser";

        it("should return true if user exists", async () => {
            vi.mocked(mockHttpClient.get).mockResolvedValue({ user: { name: username } });

            const result = await lastFmApiService.validateUsername(username);

            expect(result).toBe(true);
        });

        it("should return false if Last.fm returns error 6 (User not found) with status 200", async () => {
            vi.mocked(mockHttpClient.get).mockResolvedValue({ error: 6, message: "User not found" });

            const result = await lastFmApiService.validateUsername(username);

            expect(result).toBe(false);
        });

        it("should return false if Axios throws a 404 with error 6", async () => {
            const axiosLikeError = new Error("Not Found") as any;
            axiosLikeError.isAxiosError = true;
            axiosLikeError.response = { data: { error: 6 } };

            vi.mocked(mockHttpClient.get).mockRejectedValue(axiosLikeError);

            const result = await lastFmApiService.validateUsername(username);

            expect(result).toBe(false);
        });

        it("should return false and log error for generic network errors", async () => {
            vi.mocked(mockHttpClient.get).mockRejectedValue(new Error("Timeout"));

            const result = await lastFmApiService.validateUsername(username);

            expect(result).toBe(false);
        });
    });
});

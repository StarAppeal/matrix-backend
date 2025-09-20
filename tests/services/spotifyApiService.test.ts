import {describe, it, expect, vi, beforeEach} from "vitest";
import axios from "axios";
import {CurrentlyPlaying} from "../../src/interfaces/CurrentlyPlaying";
import {SpotifyApiService} from "../../src/services/spotifyApiService";

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        isAxiosError: vi.fn(),
    },
}));

const mockedAxios = vi.mocked(axios, true);

describe("spotifyApiService", () => {
    let consoleErrorSpy: any;

    let spotifyApiService: SpotifyApiService;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        });
        spotifyApiService = new SpotifyApiService();
    });

    describe("spotifyApiService.getCurrentlyPlaying", () => {
        it("should return currently playing track data", async () => {
            const accessToken = "test-access-token";
            const mockCurrentlyPlaying: CurrentlyPlaying = {
                timestamp: 1640995200000,
                context: {
                    type: "playlist",
                    uri: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
                },
                progress_ms: 45000,
                item: {
                    name: "Test Song",
                    artists: [
                        {
                            name: "Test Artist",
                            uri: "spotify:artist:test123",
                        },
                    ],
                    album: {
                        name: "Test Album",
                        uri: "spotify:album:test456",
                    },
                    duration_ms: 180000,
                },
                is_playing: true,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockCurrentlyPlaying,
            });

            const result = await spotifyApiService.getCurrentlyPlaying(accessToken);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                "https://api.spotify.com/v1/me/player/currently-playing",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        additional_types: "episode",
                    },
                }
            );

            expect(result).toEqual(mockCurrentlyPlaying);
        });

        it("should return null when nothing is playing (204 status)", async () => {
            const accessToken = "test-access-token";

            mockedAxios.get.mockResolvedValue({
                status: 204,
                data: null,
            });

            const result = await spotifyApiService.getCurrentlyPlaying(accessToken);

            expect(result).toBeNull();
        });

        it("should handle track with minimal data", async () => {
            const accessToken = "test-access-token";
            const mockMinimalTrack: CurrentlyPlaying = {
                timestamp: 1640995200000,
                is_playing: false,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockMinimalTrack,
            });

            const result = await spotifyApiService.getCurrentlyPlaying(accessToken);

            expect(result).toEqual(mockMinimalTrack);
            expect(result?.item).toBeUndefined();
            expect(result?.progress_ms).toBeUndefined();
        });

        it("should handle track with multiple artists", async () => {
            const accessToken = "test-access-token";
            const mockTrackWithMultipleArtists: CurrentlyPlaying = {
                timestamp: 1640995200000,
                item: {
                    name: "Collaboration Song",
                    artists: [
                        {
                            name: "Artist One",
                            uri: "spotify:artist:artist1",
                        },
                        {
                            name: "Artist Two",
                            uri: "spotify:artist:artist2",
                        },
                        {
                            name: "Artist Three",
                            uri: "spotify:artist:artist3",
                        },
                    ],
                    album: {
                        name: "Collaboration Album",
                        uri: "spotify:album:collab123",
                    },
                    duration_ms: 240000,
                },
                is_playing: true,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockTrackWithMultipleArtists,
            });

            const result = await spotifyApiService.getCurrentlyPlaying(accessToken);

            expect(result?.item?.artists).toHaveLength(3);
            expect(result?.item?.artists[0].name).toBe("Artist One");
            expect(result?.item?.artists[2].name).toBe("Artist Three");
        });

        it("should handle episodes (podcasts)", async () => {
            const accessToken = "test-access-token";
            const mockEpisode: CurrentlyPlaying = {
                timestamp: 1640995200000,
                context: {
                    type: "show",
                    uri: "spotify:show:test123",
                },
                progress_ms: 600000,
                item: {
                    name: "Test Podcast Episode",
                    artists: [
                        {
                            name: "Podcast Host",
                            uri: "spotify:artist:host123",
                        },
                    ],
                    album: {
                        name: "Test Podcast Show",
                        uri: "spotify:show:test123",
                    },
                    duration_ms: 3600000,
                },
                is_playing: true,
            };

            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: mockEpisode,
            });

            const result = await spotifyApiService.getCurrentlyPlaying(accessToken);

            expect(result).toEqual(mockEpisode);
            expect(result?.context?.type).toBe("show");
        });

        it("should handle 401 unauthorized error", async () => {
            const accessToken = "invalid-token";
            const errorData = { error: { status: 401, message: "Invalid access token" } };
            const unauthorizedError = new Error("Request failed with status code 401");
            Object.assign(unauthorizedError, {
                isAxiosError: true,
                response: {
                    status: 401,
                    data: errorData,
                }
            });

            mockedAxios.get.mockRejectedValue(unauthorizedError);
            mockedAxios.isAxiosError.mockReturnValue(true);


            await expect(spotifyApiService.getCurrentlyPlaying(accessToken))
                .rejects.toThrow(unauthorizedError);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Spotify API Error:",
                401,
                errorData
            );
        });

        it("should handle 403 forbidden error (premium required)", async () => {
            const accessToken = "valid-but-non-premium-token";
            const errorData = { error: { status: 403, message: "Player command failed: Premium required" } };
            const forbiddenError = new Error("Request failed with status code 403");
            Object.assign(forbiddenError, {
                isAxiosError: true,
                response: {
                    status: 403,
                    data: errorData,
                }
            });

            mockedAxios.get.mockRejectedValue(forbiddenError);
            mockedAxios.isAxiosError.mockReturnValue(true)

            await expect(spotifyApiService.getCurrentlyPlaying(accessToken))
                .rejects.toThrow(forbiddenError);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Spotify API Error:",
                403,
                errorData
            );
        });

        it("should handle 429 rate limit error", async () => {
            const accessToken = "test-access-token";
            const errorData = { error: { status: 429, message: "API rate limit exceeded" } };
            const rateLimitError = new Error("Request failed with status code 429");
            Object.assign(rateLimitError, {
                isAxiosError: true,
                response: {
                    status: 429,
                    data: errorData,
                    headers: {
                        "retry-after": "30",
                    },
                }
            });

            mockedAxios.get.mockRejectedValue(rateLimitError);
            mockedAxios.isAxiosError.mockReturnValue(true)

            await expect(spotifyApiService.getCurrentlyPlaying(accessToken))
                .rejects.toThrow(rateLimitError);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Spotify API Error:",
                429,
                errorData
            );
        });

        it("should throw and NOT log a specific message for generic network errors", async () => {
            const accessToken = "test-access-token";
            const networkError = new Error("Network Error");

            mockedAxios.isAxiosError.mockReturnValue(false);
            mockedAxios.get.mockRejectedValue(networkError);

            await expect(spotifyApiService.getCurrentlyPlaying(accessToken))
                .rejects.toThrow("Network Error");

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it("should include additional_types parameter for episodes", async () => {
            const accessToken = "test-access-token";

            mockedAxios.get.mockResolvedValue({
                status: 204,
                data: null,
            });

            await spotifyApiService.getCurrentlyPlaying(accessToken);

            const [, config] = mockedAxios.get.mock.calls[0];
            expect(config?.params?.additional_types).toBe("episode");
        });

        it("should use correct Spotify API endpoint", async () => {
            const accessToken = "test-access-token";

            mockedAxios.get.mockResolvedValue({
                status: 204,
                data: null,
            });

            await spotifyApiService.getCurrentlyPlaying(accessToken);

            const [url] = mockedAxios.get.mock.calls[0];
            expect(url).toBe("https://api.spotify.com/v1/me/player/currently-playing");
        });

        it("should format authorization header correctly", async () => {
            const accessToken = "test-access-token-123";

            mockedAxios.get.mockResolvedValue({
                status: 204,
                data: null,
            });

            await spotifyApiService.getCurrentlyPlaying(accessToken);

            const [, config] = mockedAxios.get.mock.calls[0];
            expect(config?.headers?.Authorization).toBe(`Bearer ${accessToken}`);
        });

        it("should handle empty access token", async () => {
            const accessToken = "";

            mockedAxios.get.mockResolvedValue({
                status: 204,
                data: null,
            });

            await spotifyApiService.getCurrentlyPlaying(accessToken);

            const [, config] = mockedAxios.get.mock.calls[0];
            expect(config?.headers?.Authorization).toBe("Bearer ");
        });
    });
});
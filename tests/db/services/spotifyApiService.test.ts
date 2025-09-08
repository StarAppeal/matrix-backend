import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { getCurrentlyPlaying, CurrentlyPlaying } from "../../../src/db/services/spotifyApiService";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios, true);

describe("spotifyApiService", () => {
  let consoleSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getCurrentlyPlaying", () => {
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

      const result = await getCurrentlyPlaying(accessToken);

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

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("Es wird gerade nichts abgespielt.");
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

      const result = await getCurrentlyPlaying(accessToken);

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

      const result = await getCurrentlyPlaying(accessToken);

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

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toEqual(mockEpisode);
      expect(result?.context?.type).toBe("show");
    });

    it("should handle 401 unauthorized error", async () => {
      const accessToken = "invalid-token";
      const unauthorizedError = {
        response: {
          status: 401,
          data: {
            error: {
              status: 401,
              message: "Invalid access token",
            },
          },
        },
      };

      mockedAxios.get.mockRejectedValue(unauthorizedError);

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Fehler bei der Anfrage:",
        401,
        unauthorizedError.response.data
      );
    });

    it("should handle 403 forbidden error (premium required)", async () => {
      const accessToken = "valid-but-non-premium-token";
      const forbiddenError = {
        response: {
          status: 403,
          data: {
            error: {
              status: 403,
              message: "Player command failed: Premium required",
            },
          },
        },
      };

      mockedAxios.get.mockRejectedValue(forbiddenError);

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Fehler bei der Anfrage:",
        403,
        forbiddenError.response.data
      );
    });

    it("should handle 429 rate limit error", async () => {
      const accessToken = "test-access-token";
      const rateLimitError = {
        response: {
          status: 429,
          data: {
            error: {
              status: 429,
              message: "API rate limit exceeded",
            },
          },
          headers: {
            "retry-after": "30",
          },
        },
      };

      mockedAxios.get.mockRejectedValue(rateLimitError);

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Fehler bei der Anfrage:",
        429,
        rateLimitError.response.data
      );
    });

    it("should handle network errors", async () => {
      const accessToken = "test-access-token";
      const networkError = {
        code: "ECONNREFUSED",
        message: "Network Error",
      };

      mockedAxios.get.mockRejectedValue(networkError);

      const result = await getCurrentlyPlaying(accessToken);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Fehler bei der Anfrage:",
        undefined,
        undefined
      );
    });

    it("should include additional_types parameter for episodes", async () => {
      const accessToken = "test-access-token";

      mockedAxios.get.mockResolvedValue({
        status: 204,
        data: null,
      });

      await getCurrentlyPlaying(accessToken);

      const [, config] = mockedAxios.get.mock.calls[0];
      expect(config?.params?.additional_types).toBe("episode");
    });

    it("should use correct Spotify API endpoint", async () => {
      const accessToken = "test-access-token";

      mockedAxios.get.mockResolvedValue({
        status: 204,
        data: null,
      });

      await getCurrentlyPlaying(accessToken);

      const [url] = mockedAxios.get.mock.calls[0];
      expect(url).toBe("https://api.spotify.com/v1/me/player/currently-playing");
    });

    it("should format authorization header correctly", async () => {
      const accessToken = "test-access-token-123";

      mockedAxios.get.mockResolvedValue({
        status: 204,
        data: null,
      });

      await getCurrentlyPlaying(accessToken);

      const [, config] = mockedAxios.get.mock.calls[0];
      expect(config?.headers?.Authorization).toBe(`Bearer ${accessToken}`);
    });

    it("should handle empty access token", async () => {
      const accessToken = "";

      mockedAxios.get.mockResolvedValue({
        status: 204,
        data: null,
      });

      await getCurrentlyPlaying(accessToken);

      const [, config] = mockedAxios.get.mock.calls[0];
      expect(config?.headers?.Authorization).toBe("Bearer ");
    });
  });
});
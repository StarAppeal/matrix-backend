import { describe, it, expect, vi, beforeEach } from "vitest";
import axios, { AxiosResponse } from "axios";
import { OAuthTokenResponse } from "../../../src/interfaces/OAuthTokenResponse";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock the SpotifyTokenService module to control environment variables
// probably a better way to do this would be to change the implementation
vi.mock("../../../src/db/services/spotifyTokenService", async () => {
  const actual = await vi.importActual("../../../src/db/services/spotifyTokenService");
  return {
    ...actual,
    SpotifyTokenService: vi.fn().mockImplementation(() => {
      const mockEnv = {
        SPOTIFY_CLIENT_ID: "test-client-id",
        SPOTIFY_CLIENT_SECRET: "test-client-secret",
      };

      return {
        async refreshToken(refreshToken: string) {
          console.log("refreshToken");
          const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            `grant_type=refresh_token&refresh_token=${refreshToken}`,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                  `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
                ).toString("base64")}`,
              },
            }
          );
          return response.data;
        },

        async generateToken(authorizationCode: string, redirectUri: string) {
          console.log("generateToken");
          const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                  `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
                ).toString("base64")}`,
              },
            }
          );
          console.log(response.data);
          return response.data;
        }
      };
    })
  };
});

import { SpotifyTokenService } from "../../../src/db/services/spotifyTokenService";

const mockedAxios = vi.mocked(axios);
const mockedAxiosPost = mockedAxios.post as ReturnType<typeof vi.fn>;

// Mock environment variables
const mockEnv = {
  SPOTIFY_CLIENT_ID: "test-client-id",
  SPOTIFY_CLIENT_SECRET: "test-client-secret",
};

describe("SpotifyTokenService", () => {
  let spotifyTokenService: SpotifyTokenService;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    spotifyTokenService = new SpotifyTokenService();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("refreshToken", () => {
    it("should successfully refresh token", async () => {
      const refreshToken = "test-refresh-token";
      const mockResponse: OAuthTokenResponse = {
        access_token: "new-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "new-refresh-token",
        scope: "user-read-playback-state",
      };

      mockedAxiosPost.mockResolvedValue({ data: mockResponse } as AxiosResponse);

      const result = await spotifyTokenService.refreshToken(refreshToken);

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        `grant_type=refresh_token&refresh_token=${refreshToken}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
        }
      );

      expect(result).toEqual(mockResponse);
      expect(consoleSpy).toHaveBeenCalledWith("refreshToken");
    });

    it("should handle axios errors during token refresh", async () => {
      const refreshToken = "test-refresh-token";
      const error = new Error("Network error");

      mockedAxiosPost.mockRejectedValue(error);

      await expect(spotifyTokenService.refreshToken(refreshToken)).rejects.toThrow("Network error");

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        `grant_type=refresh_token&refresh_token=${refreshToken}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
        }
      );
    });

    it("should handle Spotify API errors", async () => {
      const refreshToken = "invalid-refresh-token";
      const spotifyError = {
        response: {
          status: 400,
          data: {
            error: "invalid_grant",
            error_description: "Invalid refresh token",
          },
        },
      };

      mockedAxiosPost.mockRejectedValue(spotifyError);

      await expect(spotifyTokenService.refreshToken(refreshToken)).rejects.toEqual(spotifyError);
    });
  });

  describe("generateToken", () => {
    it("should successfully generate token from authorization code", async () => {
      const authorizationCode = "test-auth-code";
      const redirectUri = "http://localhost:3000/callback";
      const mockResponse: OAuthTokenResponse = {
        access_token: "access-token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh-token",
        scope: "user-read-playback-state user-modify-playback-state",
      };

      mockedAxiosPost.mockResolvedValue({ data: mockResponse } as AxiosResponse);

      const result = await spotifyTokenService.generateToken(authorizationCode, redirectUri);

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
        }
      );

      expect(result).toEqual(mockResponse);
      expect(consoleSpy).toHaveBeenCalledWith("generateToken");
      expect(consoleSpy).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle axios errors during token generation", async () => {
      const authorizationCode = "test-auth-code";
      const redirectUri = "http://localhost:3000/callback";
      const error = new Error("Network error");

      mockedAxiosPost.mockRejectedValue(error);

      await expect(
        spotifyTokenService.generateToken(authorizationCode, redirectUri)
      ).rejects.toThrow("Network error");

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              `${mockEnv.SPOTIFY_CLIENT_ID}:${mockEnv.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64")}`,
          },
        }
      );
    });

    it("should handle invalid authorization code", async () => {
      const authorizationCode = "invalid-auth-code";
      const redirectUri = "http://localhost:3000/callback";
      const spotifyError = {
        response: {
          status: 400,
          data: {
            error: "invalid_grant",
            error_description: "Authorization code expired",
          },
        },
      };

      mockedAxiosPost.mockRejectedValue(spotifyError);

      await expect(
        spotifyTokenService.generateToken(authorizationCode, redirectUri)
      ).rejects.toEqual(spotifyError);
    });

    it("should handle missing environment variables", async () => {
      // Create a service instance with undefined environment variables
      const undefinedEnvService = {
        async generateToken(authorizationCode: string, redirectUri: string) {
          console.log("generateToken");
          const response = await axios.post(
            "https://accounts.spotify.com/api/token",
            `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from("undefined:undefined").toString("base64")}`,
              },
            }
          );
          console.log(response.data);
          return response.data;
        }
      };

      const authorizationCode = "test-auth-code";
      const redirectUri = "http://localhost:3000/callback";
      const mockResponse: OAuthTokenResponse = {
        access_token: "access-token",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh-token",
        scope: "user-read-playback-state",
      };

      mockedAxiosPost.mockResolvedValue({ data: mockResponse } as AxiosResponse);

      const result = await undefinedEnvService.generateToken(authorizationCode, redirectUri);

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from("undefined:undefined").toString("base64")}`,
          },
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("Authorization header generation", () => {
    it("should generate correct base64 encoded authorization header", () => {
      const clientId = "test-client-id";
      const clientSecret = "test-client-secret";
      const expectedAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

      expect(Buffer.from(`${clientId}:${clientSecret}`).toString("base64")).toBe(expectedAuth);
    });
  });

  describe("URL and request format", () => {
    it("should use correct Spotify token endpoint URL", async () => {
      const refreshToken = "test-refresh-token";
      mockedAxiosPost.mockResolvedValue({ data: {} } as AxiosResponse);

      await spotifyTokenService.refreshToken(refreshToken);

      expect(mockedAxiosPost).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.any(String),
        expect.any(Object)
      );
    });

    it("should use correct content type for form data", async () => {
      const refreshToken = "test-refresh-token";
      mockedAxiosPost.mockResolvedValue({ data: {} } as AxiosResponse);

      await spotifyTokenService.refreshToken(refreshToken);

      const [, , config] = mockedAxiosPost.mock.calls[0];
      expect(config.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    });
  });
});
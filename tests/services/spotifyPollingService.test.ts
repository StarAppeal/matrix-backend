import {describe, it, expect, vi, beforeEach, afterEach, Mocked} from "vitest";
import { AxiosError } from "axios";
import { UserService } from "../../src/services/db/UserService";
import { SpotifyApiService } from "../../src/services/spotifyApiService";
import { SpotifyTokenService } from "../../src/services/spotifyTokenService";
import { appEventBus, SPOTIFY_STATE_UPDATED_EVENT } from "../../src/utils/eventBus";
import { SpotifyPollingService } from "../../src/services/spotifyPollingService";
import { IUser } from "../../src/db/models/user";
// @ts-ignore
import { createMockSpotifyApiService, createMockSpotifyTokenService, createMockUserService } from "../helpers/testSetup";

vi.mock("../../src/services/db/UserService");
vi.mock("../../src/services/spotifyApiService");
vi.mock("../../src/services/spotifyTokenService");
vi.mock("../../src/utils/eventBus", () => ({
    appEventBus: { emit: vi.fn() },
    SPOTIFY_STATE_UPDATED_EVENT: 'spotify:state-updated',
}));

describe("SpotifyPollingService", () => {
    let mockedUserService: Mocked<UserService>;
    let mockedApiService: Mocked<SpotifyApiService>;
    let mockedTokenService: Mocked<SpotifyTokenService>;
    let mockedAppEventBus: Mocked<typeof appEventBus>;

    let pollingService: SpotifyPollingService;

    const mockUser: IUser = {
        uuid: "user-123",
        spotifyConfig: {
            accessToken: "valid-access-token",
            refreshToken: "valid-refresh-token",
            expirationDate: new Date(Date.now() + 3600 * 1000),
        },
    } as any;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Recreate mocks
        mockedUserService = createMockUserService();
        mockedApiService = createMockSpotifyApiService() as any;
        mockedTokenService = createMockSpotifyTokenService() as any;
        mockedAppEventBus = appEventBus as Mocked<typeof appEventBus>;

        const { SpotifyPollingService: FreshSpotifyPollingService } = await import('../../src/services/spotifyPollingService');

        pollingService = new FreshSpotifyPollingService(
            mockedUserService,
            mockedApiService,
            mockedTokenService
        );

        mockedUserService.getUserByUUID.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("startPollingForUser", () => {
        it("should immediately poll and then periodically every 3 seconds", async () => {
            mockedApiService.getCurrentlyPlaying.mockResolvedValue({ item: { id: "song-a" }, is_playing: true } as any);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);

            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledOnce();
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledWith(mockUser.spotifyConfig!.accessToken);

            await vi.advanceTimersByTimeAsync(3000);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(3000);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(3);
        });

        it("should not start a new polling interval if one is already running for the user", async () => {
            pollingService.startPollingForUser(mockUser);
            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(1);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(1);

            pollingService.startPollingForUser(mockUser);
            expect(vi.getTimerCount()).toBe(1); // Still only one timer
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(1); // No new immediate poll
        });
    });

    describe("stopPollingForUser", () => {
        it("should clear the active interval for the user", () => {
            pollingService.startPollingForUser(mockUser);
            expect(vi.getTimerCount()).toBe(1);

            pollingService.stopPollingForUser(mockUser.uuid);
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe("Polling Logic and Event Emission", () => {
        it("should emit a state update event when the song changes", async () => {
            const initialState = { item: { id: "song-a" }, is_playing: true };
            const nextState = { item: { id: "song-b" }, is_playing: true };

            mockedApiService.getCurrentlyPlaying
                .mockResolvedValueOnce(initialState as any)
                .mockResolvedValueOnce(nextState as any);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(SPOTIFY_STATE_UPDATED_EVENT, { uuid: mockUser.uuid, state: initialState });
            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);


            await vi.advanceTimersByTimeAsync(3000);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(SPOTIFY_STATE_UPDATED_EVENT, { uuid: mockUser.uuid, state: nextState });

            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(2);
        });

        it("should NOT emit a state update event if the state is unchanged", async () => {
            const state = { item: { id: "song-a" }, is_playing: true };
            mockedApiService.getCurrentlyPlaying.mockResolvedValue(state as any);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);

            await vi.advanceTimersByTimeAsync(3000);

            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);
        });
    });

    describe("Token Refresh and Error Handling", () => {
        it("should refresh the token if it is expired and then call the API with the new token", async () => {
            const expiredUser = {
                ...mockUser,
                spotifyConfig: { ...mockUser.spotifyConfig!, expirationDate: new Date(Date.now() - 1000) }
            };
            mockedUserService.getUserByUUID.mockResolvedValue(expiredUser as any);

            const refreshedToken = {access_token: "new-refreshed-token", expires_in: 3600, scope: "some-scope"} as any;
            mockedTokenService.refreshToken.mockResolvedValue(refreshedToken);

            mockedUserService.updateUserByUUID.mockImplementation(async (uuid, updates) => ({
                ...expiredUser, ...updates
            } as any));

            pollingService.startPollingForUser(expiredUser as IUser);

            await vi.advanceTimersByTimeAsync(0);

            expect(mockedTokenService.refreshToken).toHaveBeenCalledWith(expiredUser.spotifyConfig.refreshToken);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledWith(refreshedToken.access_token);
        });

        it("should stop polling if a 401 Unauthorized error occurs", async () => {
            const error = new AxiosError("Unauthorized");
            (error as any).response = { status: 401 };
            mockedApiService.getCurrentlyPlaying.mockRejectedValue(error);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);

            expect(vi.getTimerCount()).toBe(0);
        });

        it("should pause and automatically resume polling after a 429 Rate Limit error", async () => {
            const error = new AxiosError("Rate Limit");
            (error as any).response = { status: 429, headers: { "retry-after": "5" } };

            mockedApiService.getCurrentlyPlaying
                .mockRejectedValueOnce(error)
                .mockResolvedValue({ item: { id: "song-a" }, is_playing: true } as any);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);

            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(1);

            await vi.advanceTimersByTimeAsync(5000);

            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(2);
            expect(vi.getTimerCount()).toBe(1);
        });
    });
});
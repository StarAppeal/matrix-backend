import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from "vitest";
import { UserService } from "../../src/services/db/UserService";
import { appEventBus, MUSIC_STATE_UPDATED_EVENT } from "../../src/utils/eventBus";
import { MusicPollingService } from "../../src/services/musicPollingService";
import { IUser } from "../../src/db/models/user";
import { createMockLastFmApiService, createMockUserService } from "../helpers/testSetup";
import { LastFmApiService } from "../../src/services/lastFmApiService";
import { MusicState } from "../../src/interfaces/MusicState";

vi.mock("../../src/services/db/UserService");
vi.mock("../../src/services/lastFmApiService");
vi.mock("../../src/utils/eventBus", () => ({
    appEventBus: { emit: vi.fn() },
    MUSIC_STATE_UPDATED_EVENT: "music:state-updated",
}));

describe("MusicPollingService", () => {
    let mockedUserService: Mocked<UserService>;
    let mockedApiService: Mocked<LastFmApiService>;
    let mockedAppEventBus: Mocked<typeof appEventBus>;

    let pollingService: MusicPollingService;

    const mockUser: IUser = {
        uuid: "user-123",
        lastFmUsername: "mockUser",
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Recreate mocks
        mockedUserService = createMockUserService() as any;
        mockedApiService = createMockLastFmApiService() as any;
        mockedAppEventBus = appEventBus as Mocked<typeof appEventBus>;

        pollingService = new MusicPollingService(mockedUserService, mockedApiService);

        mockedUserService.getUserByUUID.mockResolvedValue(mockUser);
    });

    afterEach(() => {
        if (pollingService) {
            pollingService.stopPollingForUser(mockUser.uuid);
        }

        vi.clearAllTimers();
        vi.useRealTimers();
    });

    describe("startPollingForUser", () => {
        it("should immediately poll and then periodically every 4 seconds", async () => {
            const state: MusicState = { isPlaying: true, title: "song-a", artist: "artist-a" };
            mockedApiService.getCurrentlyPlaying.mockResolvedValue(state);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);

            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledOnce();
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledWith(mockUser.lastFmUsername);

            await vi.advanceTimersByTimeAsync(4000);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(2);

            await vi.advanceTimersByTimeAsync(4000);
            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(3);
        });

        it("should stop polling if user has no lastFmUsername", async () => {
            const userWithoutLastFm = { ...mockUser};
            delete userWithoutLastFm.lastFmUsername;
            pollingService.startPollingForUser(mockUser);

            expect(mockedApiService.getCurrentlyPlaying).toHaveBeenCalledTimes(0);
        })

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
            // @ts-ignore - access to private property for test
            expect(pollingService.activePolls.size).toBe(0);
        });
    });

    describe("Polling Logic and Event Emission", () => {
        it("should emit a state update event when the song changes", async () => {
            const initialState: MusicState = { isPlaying: true, title: "song-a", artist: "artist-a" };
            const nextState: MusicState = { isPlaying: true, title: "song-b", artist: "artist-a" };

            mockedApiService.getCurrentlyPlaying.mockResolvedValueOnce(initialState).mockResolvedValueOnce(nextState);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(MUSIC_STATE_UPDATED_EVENT, {
                uuid: mockUser.uuid,
                state: initialState,
            });
            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(4000);
            expect(mockedAppEventBus.emit).toHaveBeenCalledWith(MUSIC_STATE_UPDATED_EVENT, {
                uuid: mockUser.uuid,
                state: nextState,
            });

            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(2);
        });

        it("should NOT emit a state update event if the state is unchanged", async () => {
            const state: MusicState = { isPlaying: true, title: "song-a", artist: "artist-a" };
            mockedApiService.getCurrentlyPlaying.mockResolvedValue(state);

            pollingService.startPollingForUser(mockUser);

            await vi.advanceTimersByTimeAsync(0);
            await vi.advanceTimersByTimeAsync(4000);

            expect(mockedAppEventBus.emit).toHaveBeenCalledTimes(1);
        });
    });
});

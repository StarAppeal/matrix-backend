import { appEventBus, SPOTIFY_STATE_UPDATED_EVENT } from "../utils/eventBus";
import { SpotifyApiService } from "./spotifyApiService";
import { IUser } from "../db/models/user";
import { AxiosError } from "axios";
import {UserService} from "./db/UserService";
import {SpotifyTokenService} from "./spotifyTokenService";

const userStateCache = new Map<string, any>();
const activePolls = new Map<string, NodeJS.Timeout>();

export class SpotifyPollingService {
    constructor(
        private readonly userService: UserService,
        private readonly spotifyApiService: SpotifyApiService,
        private readonly spotifyTokenService: SpotifyTokenService,
    ) {}

    public startPollingForUser(user: IUser): void {
        const uuid = user.uuid;
        if (activePolls.has(uuid)) return;

        console.log(`[SpotifyPolling] Starting polling for user ${uuid}`);
        const intervalId = setInterval(() => this._pollUser(uuid), 3000); // Sicherer 3-Sekunden-Intervall
        activePolls.set(uuid, intervalId);

        this._pollUser(uuid);
    }

    public stopPollingForUser(uuid: string): void {
        if (activePolls.has(uuid)) {
            console.log(`[SpotifyPolling] Stopping polling for user ${uuid}`);
            clearInterval(activePolls.get(uuid)!);
            activePolls.delete(uuid);
            userStateCache.delete(uuid);
        }
    }

    private async _pollUser(uuid: string): Promise<void> {
        let user = await this.userService.getUserByUUID(uuid);
        if (!user || !user.spotifyConfig) {
            this.stopPollingForUser(uuid);
            return;
        }

        try {
            if (Date.now() > user.spotifyConfig.expirationDate.getTime()) {
                console.log(`[SpotifyPolling] Token for ${uuid} expired, refreshing...`);
                const token = await this.spotifyTokenService.refreshToken(user.spotifyConfig.refreshToken);
                const newConfig = {
                    refreshToken: user.spotifyConfig.refreshToken,
                    accessToken: token.access_token,
                    expirationDate: new Date(Date.now() + token.expires_in * 1000),
                    scope: token.scope,
                };
                user = await this.userService.updateUserByUUID(uuid, { spotifyConfig: newConfig });

                console.log(`[SpotifyPolling] Token for ${uuid} refreshed.`);
            }

            const currentState = await this.spotifyApiService.getCurrentlyPlaying(user!.spotifyConfig!.accessToken);
            const lastState = userStateCache.get(uuid);

            if (this._hasStateChanged(lastState, currentState)) {
                console.log(`[SpotifyPolling] State change for ${uuid}. Emitting event.`);
                userStateCache.set(uuid, currentState);
                appEventBus.emit(SPOTIFY_STATE_UPDATED_EVENT, { uuid, state: currentState });
            }

        } catch (error) {
            if (error instanceof AxiosError && error.response) {
                if (error.response.status === 429) {
                    const retryAfter = Number(error.response.headers['retry-after'] || 5);
                    console.warn(`[SpotifyPolling] Rate limit for ${uuid}. Pausing for ${retryAfter}s.`);
                    this._pausePolling(uuid, retryAfter * 1000);
                } else if (error.response.status === 401) {
                    console.error(`[SpotifyPolling] Bad token for ${uuid}. Stopping poll.`);
                    this.stopPollingForUser(uuid);
                }
            } else {
                console.error(`[SpotifyPolling] Unknown error for ${uuid}:`, error);
            }
        }
    }

    private _hasStateChanged(lastState: any, currentState: any): boolean {
        if (!currentState && !lastState) return false;
        if (!currentState || !lastState) return true;

        return lastState.item?.id !== currentState.item?.id ||
            lastState.is_playing !== currentState.is_playing;
    }

    private _pausePolling(uuid: string, durationMs: number): void {
        if (activePolls.has(uuid)) {
            clearInterval(activePolls.get(uuid)!);
            activePolls.delete(uuid);
            setTimeout(() => {
                console.log(`[SpotifyPolling] Resuming polling for ${uuid}.`);
                this.userService.getUserByUUID(uuid).then(user => {
                    if (user) this.startPollingForUser(user);
                });
            }, durationMs);
        }
    }
}
import { appEventBus, SPOTIFY_STATE_UPDATED_EVENT } from "../utils/eventBus";
import { SpotifyApiService } from "./spotifyApiService";
import { IUser } from "../db/models/user";
import { AxiosError } from "axios";
import { UserService } from "./db/UserService";
import { SpotifyTokenService } from "./spotifyTokenService";
import logger from "../utils/logger";
import { CurrentlyPlaying } from "../interfaces/CurrentlyPlaying";

export class SpotifyPollingService {
    private readonly userStateCache = new Map<string, CurrentlyPlaying>();
    private readonly activePolls = new Map<string, NodeJS.Timeout | null>();

    constructor(
        private readonly userService: UserService,
        private readonly spotifyApiService: SpotifyApiService,
        private readonly spotifyTokenService: SpotifyTokenService
    ) {}

    public startPollingForUser(user: IUser): void {
        const uuid = user.uuid;
        if (this.activePolls.has(uuid)) return;

        logger.info(`Starting Spotify polling service for user ${uuid}`);

        const poll = async () => {
            if (!this.activePolls.has(uuid)) return;

            await this._pollUser(uuid);

            if (this.activePolls.has(uuid)) {
                const timeoutId = setTimeout(poll, 3000);
                this.activePolls.set(uuid, timeoutId);
            }
        };

        this.activePolls.set(uuid, null);

        poll();
    }

    public stopPollingForUser(uuid: string): void {
        if (this.activePolls.has(uuid)) {
            logger.info(`Stopping Spotify polling service for user ${uuid}`);
            clearTimeout(this.activePolls.get(uuid)!);
            this.activePolls.delete(uuid);
            this.userStateCache.delete(uuid);
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
                logger.debug(`Spotify token expired for user ${uuid}, refreshing token`);
                const token = await this.spotifyTokenService.refreshToken(user.spotifyConfig.refreshToken);
                const newConfig = {
                    refreshToken: user.spotifyConfig.refreshToken,
                    accessToken: token.access_token,
                    expirationDate: new Date(Date.now() + token.expires_in * 1000),
                    scope: token.scope,
                };
                user = await this.userService.updateUserByUUID(uuid, { spotifyConfig: newConfig });

                logger.debug(`Successfully refreshed Spotify token for user ${uuid}`);
            }

            const currentState = await this.spotifyApiService.getCurrentlyPlaying(user!.spotifyConfig!.accessToken);
            const lastState = this.userStateCache.get(uuid);

            if (this._hasStateChanged(lastState, currentState)) {
                logger.debug(`Spotify state changed for user ${uuid} - emitting update event`);
                this.userStateCache.set(uuid, currentState!);
                appEventBus.emit(SPOTIFY_STATE_UPDATED_EVENT, { uuid, state: currentState });
            }
        } catch (error) {
            if (error instanceof AxiosError && error.response) {
                if (error.response.status === 429) {
                    const retryAfter = Number(error.response.headers["retry-after"] || 5);
                    logger.warn(`Spotify API rate limit reached for user ${uuid}. Pausing for ${retryAfter} seconds`);
                    this._pausePolling(uuid, retryAfter * 1000);
                } else if (error.response.status === 401) {
                    logger.error(`Invalid Spotify token for user ${uuid}. Stopping polling service`);
                    this.stopPollingForUser(uuid);
                }
            } else {
                logger.error(`Unknown error in Spotify polling service for user ${uuid}:`, error);
            }
        }
    }

    private _hasStateChanged(
        lastState: CurrentlyPlaying | undefined | null,
        currentState: CurrentlyPlaying | undefined | null
    ): boolean {
        if (!currentState && !lastState) return false;
        if (!currentState || !lastState) return true;

        return lastState.item?.id !== currentState.item?.id || lastState.is_playing !== currentState.is_playing;
    }

    private _pausePolling(uuid: string, durationMs: number): void {
        if (this.activePolls.has(uuid)) {
            clearTimeout(this.activePolls.get(uuid)!);
            this.activePolls.delete(uuid);
            setTimeout(() => {
                logger.debug(`Resuming Spotify polling service for user ${uuid}`);
                this.userService.getUserByUUID(uuid).then((user) => {
                    if (user) this.startPollingForUser(user);
                });
            }, durationMs);
        }
    }
}

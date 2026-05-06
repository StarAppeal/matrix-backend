import { appEventBus, MUSIC_STATE_UPDATED_EVENT } from "../utils/eventBus";
import { IUser } from "../db/models/user";
import { UserService } from "./db/UserService";
import { LastFmApiService } from "./lastFmApiService";
import { MusicState } from "../interfaces/MusicState";
import logger from "../utils/logger";

import { IUserPollingService } from "./IUserPollingService";

export class MusicPollingService implements IUserPollingService {
    private readonly userStateCache = new Map<string, MusicState>();
    private readonly activePolls = new Map<string, NodeJS.Timeout | null>();

    constructor(
        private readonly userService: UserService,
        private readonly musicApiService: LastFmApiService
    ) { }

    public startPollingForUser(uuid: string): void {
        if (this.activePolls.has(uuid)) return;

        logger.info(`Starting Music polling service for user ${uuid}`);

        const poll = async () => {
            if (!this.activePolls.has(uuid)) return;

            await this._pollUser(uuid);

            if (this.activePolls.has(uuid)) {
                const timeoutId = setTimeout(poll, 4000);
                this.activePolls.set(uuid, timeoutId);
            }
        };

        this.activePolls.set(uuid, null);
        poll();
    }

    public stopPollingForUser(uuid: string): void {
        if (this.activePolls.has(uuid)) {
            logger.info(`Stopping Music polling service for user ${uuid}`);
            clearTimeout(this.activePolls.get(uuid)!);
            this.activePolls.delete(uuid);
            this.userStateCache.delete(uuid);
        }
    }

    private async _pollUser(uuid: string): Promise<void> {
        const user = await this.userService.getUserByUUID(uuid);

        if (!user || !user.lastFmUsername) {
            logger.warn(`User ${uuid} has no lastFmUsername. Stopping polling service.`);
            this.stopPollingForUser(uuid);
            return;
        }

        const currentState = await this.musicApiService.getCurrentlyPlaying(user.lastFmUsername);
        const lastState = this.userStateCache.get(uuid);

        if (this._hasStateChanged(lastState, currentState)) {
            logger.debug(`Music state changed for user ${uuid} - emitting update`);
            this.userStateCache.set(uuid, currentState);
            appEventBus.emit(MUSIC_STATE_UPDATED_EVENT, { uuid, state: currentState });
        }
    }

    private _hasStateChanged(last: MusicState | undefined, current: MusicState): boolean {
        if (!last) return true;
        if (last.isPlaying !== current.isPlaying) return true;
        if (!current.isPlaying) return false;

        return last.title !== current.title || last.artist !== current.artist;
    }
}

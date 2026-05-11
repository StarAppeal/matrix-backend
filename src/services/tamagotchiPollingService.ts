import { appEventBus, TAMAGOTCHI_STATE_UPDATED_EVENT } from "../utils/eventBus";
import logger from "../utils/logger";
import { TamagotchiPayload, TamagotchiService } from "./db/tamagotchiService";
import { TICK_INTERVAL_MS } from "../db/models/tamagotchi";
import { IUserPollingService } from "./IUserPollingService";

export class TamagotchiPollingService implements IUserPollingService {
    private readonly activeUsers = new Set<string>();
    private globalPollTimer: NodeJS.Timeout | null = null;

    constructor(private readonly tamagotchiService: TamagotchiService) {}

    public async startPollingForUser(uuid: string): Promise<void> {
        if (this.activeUsers.has(uuid)) return;

        logger.info(`Starting Tamagotchi polling service for user ${uuid}`);

        const pet = await this.tamagotchiService.getOrEvaluatePet(uuid);
        this._emitUpdate(uuid, TamagotchiService.toPayload(pet));

        this.activeUsers.add(uuid);

        if (!this.globalPollTimer) {
            this._startGlobalLoop();
        }
    }

    public stopPollingForUser(uuid: string): void {
        if (this.activeUsers.has(uuid)) {
            logger.info(`Stopping Tamagotchi polling service for user ${uuid}`);
            this.activeUsers.delete(uuid);
        }

        if (this.activeUsers.size === 0 && this.globalPollTimer) {
            clearInterval(this.globalPollTimer);
            this.globalPollTimer = null;
        }
    }

    private _startGlobalLoop() {
        logger.info("Starting global Tamagotchi tick loop");
        this.globalPollTimer = setInterval(async () => {
            for (const uuid of this.activeUsers) {
                try {
                    const updatedPet = await this.tamagotchiService.processTick(uuid);
                    if (updatedPet) {
                        this._emitUpdate(uuid, TamagotchiService.toPayload(updatedPet));
                    }
                } catch (error) {
                    logger.error(`Error during Tamagotchi tick for user ${uuid}:`, error);
                }
            }
        }, TICK_INTERVAL_MS);
    }

    private _emitUpdate(uuid: string, payload: TamagotchiPayload) {
        appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, { uuid, payload });
    }
}

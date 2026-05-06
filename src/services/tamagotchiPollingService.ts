import { appEventBus, TAMAGOTCHI_STATE_UPDATED_EVENT } from "../utils/eventBus";
import logger from "../utils/logger";
import { TamagotchiPayload, TamagotchiService } from "./db/tamagotchiService";
import { TICK_INTERVAL_MS } from "../db/models/tamagotchi";

import { IUserPollingService } from "./IUserPollingService";

export class TamagotchiPollingService implements IUserPollingService {
    private readonly activePolls = new Map<string, NodeJS.Timeout>();

    constructor(private readonly tamagotchiService: TamagotchiService) {}

    public async startPollingForUser(uuid: string): Promise<void> {
        if (this.activePolls.has(uuid)) return;

        logger.info(`Starting Tamagotchi polling service for user ${uuid}`);

        const pet = await this.tamagotchiService.getOrEvaluatePet(uuid);
        this._emitUpdate(uuid, TamagotchiService.toPayload(pet));

        const intervalId = setInterval(async () => {
            try {
                const updatedPet = await this.tamagotchiService.processTick(uuid);
                if (updatedPet) {
                    this._emitUpdate(uuid, TamagotchiService.toPayload(updatedPet));
                }
            } catch (error) {
                logger.error(`Error during Tamagotchi tick for user ${uuid}:`, error);
            }
        }, TICK_INTERVAL_MS);

        this.activePolls.set(uuid, intervalId);
    }

    public stopPollingForUser(uuid: string): void {
        const intervalId = this.activePolls.get(uuid);
        if (intervalId) {
            logger.info(`Stopping Tamagotchi polling service for user ${uuid}`);
            clearInterval(intervalId);
            this.activePolls.delete(uuid);
        }
    }

    private _emitUpdate(uuid: string, payload: TamagotchiPayload) {
        appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, { uuid, payload });
    }
}

import {
    DECAY_RATES,
    ITamagotchi,
    TamagotchiModel,
    TamagotchiState,
    TICK_INTERVAL_MS,
} from "../../db/models/tamagotchi";
import logger from "../../utils/logger";
import { appEventBus, TAMAGOTCHI_STATE_UPDATED_EVENT } from "../../utils/eventBus";

export interface TamagotchiPayload {
    hunger: number;
    happiness: number;
    hygiene: number;
    energy: number;
    status: TamagotchiState;
}

export class TamagotchiService {
    private readonly _activeAnimationTimers = new Map<string, NodeJS.Timeout>();

    public isBusy(uuid: string): boolean {
        return this._activeAnimationTimers.has(uuid);
    }

    public static toPayload(pet: ITamagotchi): TamagotchiPayload {
        return {
            hunger: pet.hunger,
            happiness: pet.happiness,
            hygiene: pet.hygiene,
            energy: pet.energy,
            status: pet.status,
        };
    }

    public async getOrEvaluatePet(uuid: string): Promise<ITamagotchi> {
        const pet = await TamagotchiModel.findOne({ uuid });
        if (!pet) {
            return await TamagotchiModel.create({ uuid });
        }

        const now = new Date();
        const diffMs = now.getTime() - pet.lastCalculatedAt.getTime();
        const missedTicks = Math.floor(diffMs / TICK_INTERVAL_MS);

        if (missedTicks > 0) {
            logger.info(`Evaluating pet ${uuid} for ${missedTicks} missed ticks (${diffMs} ms)`);
            pet.hunger = Math.max(0, pet.hunger - missedTicks * DECAY_RATES.hunger);
            pet.happiness = Math.max(0, pet.happiness - missedTicks * DECAY_RATES.happiness);
            pet.hygiene = Math.max(0, pet.hygiene - missedTicks * DECAY_RATES.hygiene);
            pet.energy = Math.max(0, pet.energy - missedTicks * DECAY_RATES.energy);

            this.evaluateStatus(pet);

            const addedTime = missedTicks * TICK_INTERVAL_MS;
            pet.lastCalculatedAt = new Date(pet.lastCalculatedAt.getTime() + addedTime);
            await pet.save();
        }
        return pet;
    }

    public async processTick(uuid: string): Promise<ITamagotchi | null> {
        const pet = await TamagotchiModel.findOne({ uuid });
        if (!pet || pet.status === TamagotchiState.DEAD) return pet;

        pet.hunger = Math.max(0, pet.hunger - DECAY_RATES.hunger);
        pet.happiness = Math.max(0, pet.happiness - DECAY_RATES.happiness);
        pet.hygiene = Math.max(0, pet.hygiene - DECAY_RATES.hygiene);
        pet.energy = Math.max(0, pet.energy - DECAY_RATES.energy);
        pet.lastCalculatedAt = new Date();

        this.evaluateStatus(pet);
        await pet.save();
        return pet;
    }

    public async feed(uuid: string): Promise<TamagotchiPayload> {
        const pet = await this.getOrEvaluatePet(uuid);
        if (pet.status === TamagotchiState.DEAD) return TamagotchiService.toPayload(pet);

        pet.hunger = Math.min(100, pet.hunger + 30);
        this.evaluateStatus(pet);
        await pet.save();

        this._emitTransientAction(uuid, pet, TamagotchiState.EATING);

        return { ...TamagotchiService.toPayload(pet), status: TamagotchiState.EATING };
    }

    public async play(uuid: string): Promise<TamagotchiPayload> {
        const pet = await this.getOrEvaluatePet(uuid);
        if (pet.status === TamagotchiState.DEAD) return TamagotchiService.toPayload(pet);

        pet.happiness = Math.min(100, pet.happiness + 30);
        pet.energy = Math.max(0, pet.energy - 10);
        this.evaluateStatus(pet);
        await pet.save();

        this._emitTransientAction(uuid, pet, TamagotchiState.PLAYING);

        return { ...TamagotchiService.toPayload(pet), status: TamagotchiState.PLAYING };
    }

    public evaluateStatus(pet: ITamagotchi) {
        if (pet.hunger === 0 && pet.happiness === 0) {
            pet.status = TamagotchiState.DEAD;
        } else if (pet.hunger < 30 || pet.hygiene < 30) {
            pet.status = TamagotchiState.IDLE_SICK;
        } else {
            pet.status = TamagotchiState.IDLE_HAPPY;
        }
    }

    private _emitTransientAction(uuid: string, pet: ITamagotchi, transientStatus: TamagotchiState) {
        const existingTimer = this._activeAnimationTimers.get(uuid);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, {
            uuid,
            payload: { ...TamagotchiService.toPayload(pet), status: transientStatus },
        });

        const timer = setTimeout(async () => {
            this._activeAnimationTimers.delete(uuid);
            try {
                const freshPet = await TamagotchiModel.findOne({ uuid });
                if (freshPet && freshPet.status !== TamagotchiState.DEAD) {
                    this.evaluateStatus(freshPet);
                    appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, {
                        uuid,
                        payload: TamagotchiService.toPayload(freshPet),
                    });
                }
            } catch (err) {
                logger.error("Error while resetting tamagotchi state:", err);
            }
        }, 4000);

        this._activeAnimationTimers.set(uuid, timer);
    }
}


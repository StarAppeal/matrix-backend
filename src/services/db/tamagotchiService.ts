import {
    AWAKE_DECAY_RATES,
    ITamagotchi,
    SLEEPING_DECAY_RATES,
    STAT_THRESHOLDS,
    TamagotchiModel,
    TamagotchiState,
    TICK_INTERVAL_MS,
} from "../../db/models/tamagotchi";
import logger from "../../utils/logger";
import { appEventBus, TAMAGOTCHI_STATE_UPDATED_EVENT } from "../../utils/eventBus";

export interface TamagotchiVisuals {
    has_glasses: boolean;
    dirt_intensity: number;
    stink_intensity: number;
}

export interface TamagotchiPayload {
    hunger: number;
    happiness: number;
    hygiene: number;
    energy: number;
    status: TamagotchiState;
    visuals?: TamagotchiVisuals;
}

export class TamagotchiService {
    private readonly _activeAnimationTimers = new Map<string, NodeJS.Timeout>();

    public isBusy(uuid: string): boolean {
        return this._activeAnimationTimers.has(uuid);
    }

    public static toPayload(pet: ITamagotchi, overrideStatus?: TamagotchiState): TamagotchiPayload {
        const activeStatus = overrideStatus || pet.status;
        const isDead = activeStatus === TamagotchiState.DEAD;

        let dirt_intensity = 0;
        if (!isDead && pet.hygiene < STAT_THRESHOLDS.DIRT) {
            dirt_intensity = (STAT_THRESHOLDS.DIRT - pet.hygiene) / STAT_THRESHOLDS.DIRT;
        }

        let stink_intensity = 0;
        if (!isDead && pet.hygiene < STAT_THRESHOLDS.STINK) {
            stink_intensity = (STAT_THRESHOLDS.STINK - pet.hygiene) / STAT_THRESHOLDS.STINK;
        }

        const has_glasses =
            !isDead && pet.happiness > STAT_THRESHOLDS.GLASSES && activeStatus === TamagotchiState.IDLE_HAPPY;

        return {
            hunger: pet.hunger,
            happiness: pet.happiness,
            hygiene: pet.hygiene,
            energy: pet.energy,
            status: activeStatus,
            visuals: {
                has_glasses,
                dirt_intensity: Math.max(0, Math.min(1, dirt_intensity)),
                stink_intensity: Math.max(0, Math.min(1, stink_intensity)),
            },
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
            const decayRates = this._getDecayRates(pet);
            logger.info(`Evaluating pet ${uuid} for ${missedTicks} missed ticks (${diffMs} ms)`);
            this._applyStatChanges(pet, {
                hunger: -(missedTicks * decayRates.hunger),
                happiness: -(missedTicks * decayRates.happiness),
                hygiene: -(missedTicks * decayRates.hygiene),
                energy: -(missedTicks * decayRates.energy),
            });

            const addedTime = missedTicks * TICK_INTERVAL_MS;
            pet.lastCalculatedAt = new Date(pet.lastCalculatedAt.getTime() + addedTime);
            await pet.save();
        }
        return pet;
    }

    public async processTick(uuid: string): Promise<ITamagotchi | null> {
        const pet = await TamagotchiModel.findOne({ uuid });
        if (!pet || pet.status === TamagotchiState.DEAD) return pet;

        const decayRates = this._getDecayRates(pet);

        this._applyStatChanges(pet, {
            hunger: -decayRates.hunger,
            happiness: -decayRates.happiness,
            hygiene: -decayRates.hygiene,
            energy: -decayRates.energy,
        });

        pet.lastCalculatedAt = new Date();
        await pet.save();
        return pet;
    }

    public async feed(uuid: string): Promise<TamagotchiPayload> {
        return this._executeAction(uuid, TamagotchiState.EATING, { hunger: 30 });
    }

    public async play(uuid: string): Promise<TamagotchiPayload> {
        return this._executeAction(uuid, TamagotchiState.PLAYING, { happiness: 30, energy: -10 });
    }

    public async clean(uuid: string): Promise<TamagotchiPayload> {
        return this._executeAction(uuid, TamagotchiState.CLEANING, { hygiene: 30, happiness: 10 });
    }

    public async sleep(uuid: string): Promise<TamagotchiPayload> {
        const pet = await this.getOrEvaluatePet(uuid);
        if (pet.status === TamagotchiState.DEAD) return TamagotchiService.toPayload(pet);

        // go to sleep permanently
        pet.status = TamagotchiState.SLEEPING;
        await pet.save();

        appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, {
            uuid,
            payload: TamagotchiService.toPayload(pet),
        });
        return TamagotchiService.toPayload(pet);
    }

    public async awake(uuid: string): Promise<TamagotchiPayload> {
        const pet = await this.getOrEvaluatePet(uuid);

        if (pet.status === TamagotchiState.DEAD || pet.status !== TamagotchiState.SLEEPING) {
            return TamagotchiService.toPayload(pet);
        }

        // kind of a small hack though, we have to temporary change the pet status
        // so the evaluation is correct:
        pet.status = TamagotchiState.AWAKING;

        // and NOW we have to evaluate it again for the correct idiomatic status
        this.evaluateStatus(pet);

        await pet.save();

        this._emitTransientAction(uuid, pet, TamagotchiState.AWAKING);

        return { ...TamagotchiService.toPayload(pet), status: TamagotchiState.AWAKING };
    }

    public evaluateStatus(pet: ITamagotchi) {
        if (pet.hunger === 0 && pet.happiness === 0) {
            pet.status = TamagotchiState.DEAD;
        } else if (pet.status === TamagotchiState.SLEEPING) {
            // keep sleeping
            return;
        } else if (pet.hunger < STAT_THRESHOLDS.SAD || pet.hygiene < STAT_THRESHOLDS.SAD) {
            pet.status = TamagotchiState.IDLE_SAD;
        } else if (pet.energy < STAT_THRESHOLDS.TIRED) {
            pet.status = TamagotchiState.IDLE_TIRED;
        } else {
            pet.status = TamagotchiState.IDLE_HAPPY;
        }
    }

    private _emitTransientAction(uuid: string, pet: ITamagotchi, transientStatus: TamagotchiState) {
        const existingTimer = this._activeAnimationTimers.get(uuid);
        if (existingTimer) clearTimeout(existingTimer);

        appEventBus.emit(TAMAGOTCHI_STATE_UPDATED_EVENT, {
            uuid,
            payload: TamagotchiService.toPayload(pet, transientStatus),
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

    private async _executeAction(
        uuid: string,
        transientState: TamagotchiState,
        statChanges: Partial<TamagotchiPayload>
    ): Promise<TamagotchiPayload> {
        const pet = await this.getOrEvaluatePet(uuid);

        if (pet.status === TamagotchiState.DEAD) {
            return TamagotchiService.toPayload(pet);
        }

        this._applyStatChanges(pet, statChanges);
        await pet.save();

        this._emitTransientAction(uuid, pet, transientState);

        return { ...TamagotchiService.toPayload(pet), status: transientState };
    }

    private _applyStatChanges(pet: ITamagotchi, changes: Partial<TamagotchiPayload>) {
        if (changes.hunger !== undefined) pet.hunger = Math.min(100, Math.max(0, pet.hunger + changes.hunger));
        if (changes.happiness !== undefined)
            pet.happiness = Math.min(100, Math.max(0, pet.happiness + changes.happiness));
        if (changes.hygiene !== undefined) pet.hygiene = Math.min(100, Math.max(0, pet.hygiene + changes.hygiene));
        if (changes.energy !== undefined) pet.energy = Math.min(100, Math.max(0, pet.energy + changes.energy));

        this.evaluateStatus(pet);
    }

    private _getDecayRates(pet: ITamagotchi): {
        hunger: number;
        energy: number;
        happiness: number;
        hygiene: number;
    } {
        return pet.status === TamagotchiState.SLEEPING ? SLEEPING_DECAY_RATES : AWAKE_DECAY_RATES;
    }
}

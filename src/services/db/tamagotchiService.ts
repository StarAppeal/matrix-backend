import {
    DECAY_RATES,
    ITamagotchi,
    TamagotchiModel,
    TamagotchiState,
    TICK_INTERVAL_MS,
} from "../../db/models/tamagotchi";

export interface TamagotchiPayload {
    hunger: number;
    happiness: number;
    hygiene: number;
    energy: number;
    status: TamagotchiState;
}

export class TamagotchiService {
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
            pet.hunger = Math.max(0, pet.hunger - missedTicks * DECAY_RATES.hunger);
            pet.happiness = Math.max(0, pet.happiness - missedTicks * DECAY_RATES.happiness);
            pet.hygiene = Math.max(0, pet.hygiene - missedTicks * DECAY_RATES.hygiene);

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
        pet.lastCalculatedAt = new Date();

        this.evaluateStatus(pet);
        await pet.save();
        return pet;
    }

    public async feed(uuid: string): Promise<ITamagotchi> {
        const pet = await this.getOrEvaluatePet(uuid);
        if (pet.status === TamagotchiState.DEAD) return pet;

        pet.hunger = Math.min(100, pet.hunger + 30);
        pet.status = TamagotchiState.EATING;
        await pet.save();
        return pet;
    }

    public evaluateStatus(pet: ITamagotchi) {
        if (pet.hunger === 0 && pet.happiness === 0) {
            pet.status = TamagotchiState.DEAD;
        } else if (pet.hunger < 30 || pet.hygiene < 30) {
            pet.status = TamagotchiState.IDLE_SICK;
        } else if (pet.status !== TamagotchiState.EATING && pet.status !== TamagotchiState.PLAYING) {
            pet.status = TamagotchiState.IDLE_HAPPY;
        }
    }
}

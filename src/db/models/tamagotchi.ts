import mongoose, { Schema, Document } from "mongoose";

export const TICK_INTERVAL_MS = 60 * 1000;
export const DECAY_RATES = { hunger: 1, happiness: 1, hygiene: 0.5, energy: 1 };

export enum TamagotchiState {
    IDLE_HAPPY = "IDLE_HAPPY",
    IDLE_SICK = "IDLE_SICK",
    EATING = "EATING",
    PLAYING = "PLAYING",
    DEAD = "DEAD", // R.I.P
}

export interface ITamagotchi extends Document {
    uuid: string;
    hunger: number;
    happiness: number;
    hygiene: number;
    energy: number;
    status: TamagotchiState;
    lastCalculatedAt: Date;
}

const tamagotchiSchema = new Schema(
    {
        uuid: { type: String, required: true, unique: true, index: true },
        hunger: { type: Number, default: 80, min: 0, max: 100 },
        happiness: { type: Number, default: 80, min: 0, max: 100 },
        hygiene: { type: Number, default: 100, min: 0, max: 100 },
        energy: { type: Number, default: 100, min: 0, max: 100 },
        status: { type: String, enum: Object.values(TamagotchiState), default: TamagotchiState.IDLE_HAPPY },
        lastCalculatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const TamagotchiModel = mongoose.model<ITamagotchi>("Tamagotchi", tamagotchiSchema);

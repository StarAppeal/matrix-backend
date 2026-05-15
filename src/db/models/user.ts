import "dotenv/config";
import mongoose, { Schema, Document, CallbackError } from "mongoose";
import { PasswordUtils } from "../../utils/passwordUtils";

export interface IUser extends Document {
    name: string;
    password?: string;
    uuid: string;
    config: UserConfig;
    lastState?: MatrixState;
    lastFmUsername?: string;
    timezone: string;
    location: {
        name: string;
        lat: number;
        lon: number;
    };
    isDeleted: boolean;
    deletedAt?: Date;
}

export interface CreateUserPayload {
    name: string;
    password: string;
    uuid: string;
    config: UserConfig;
    timezone: string;
    location: {
        name: string;
        lat: number;
        lon: number;
    };
}

export interface UserConfig {
    isVisible: boolean;
    canBeModified: boolean;
    isAdmin: boolean;
}

export interface MatrixState {
    global: {
        mode: "image" | "text" | "idle" | "music" | "clock" | "game_of_life";
        brightness: number;
    };
    text: {
        text: string;
        align: "left" | "center" | "right";
        speed: number;
        size: number;
        color: [number, number, number];
    };
    image: {
        image_url?: string;
        s3_key: string;
    };
    clock: {
        color: [number, number, number];
    };
    music: {
        fullscreen: boolean;
    };
    game_of_life: {
        color: [number, number, number];
        speed: number;
        cell_size: number;
    };
}

const matrixStateSchema = new Schema(
    {
        global: {
            mode: { type: String, enum: ["image", "text", "idle", "music", "clock", "game_of_life"], default: "idle" },
            brightness: { type: Number, min: 0, max: 100, default: 50 },
        },
        text: {
            text: { type: String, default: "" },
            align: { type: String, enum: ["left", "center", "right"], default: "center" },
            speed: { type: Number, min: 0, max: 10, default: 3 },
            size: { type: Number, min: 1, max: 6, default: 3 },
            color: {
                type: [Number],
                validate: {
                    validator: (v: number[]) =>
                        Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
                    message: "color must be an array of three integers between 0 and 255",
                },
                default: [255, 255, 255],
            },
        },
        image: {
            s3_key: { type: String, default: "" },
        },
        clock: {
            color: {
                type: [Number],
                validate: {
                    validator: (v: number[]) =>
                        Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
                    message: "color must be an array of three integers between 0 and 255",
                },
                default: [255, 255, 255],
            },
        },
        music: {
            fullscreen: { type: Boolean, default: false },
        },
        game_of_life: {
            color: {
                type: [Number],
                validate: {
                    validator: (v: number[]) =>
                        Array.isArray(v) && v.length === 3 && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
                    message: "color must be an array of three integers between 0 and 255",
                },
                default: [255, 255, 255],
            },
            speed: { type: Number, min: 0, max: 30, default: 20 },
            cell_size: { type: Number, min: 1, max: 4, default: 2 },
        },
    },
    { _id: false }
);

const userConfigSchema = new Schema(
    {
        isVisible: { type: Boolean, required: true },
        canBeModified: { type: Boolean, required: true },
        isAdmin: { type: Boolean, required: true },
    },
    { _id: false }
);

const locationSchema = new Schema(
    {
        name: { type: String, required: true },
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
    },
    { _id: false }
);

const userSchema = new Schema(
    {
        name: { type: String, required: true, index: true },
        password: { type: String, required: true, select: false },
        uuid: { type: String, required: true, unique: true, index: true },
        config: { type: userConfigSchema, required: true },
        lastState: { type: matrixStateSchema },
        lastFmUsername: { type: String },
        timezone: { type: String, required: true },
        location: { type: locationSchema, required: true },
        isDeleted: { type: Boolean, required: true, default: false, index: true },
        deletedAt: { type: Date },
    },
    {
        optimisticConcurrency: true,
        timestamps: true,
    }
);

userSchema.virtual("id").get(function (this: mongoose.Document & IUser) {
    return (this._id as mongoose.Types.ObjectId)?.toHexString() ?? this._id;
});

function isBcryptHash(value: unknown): boolean {
    return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function hashIfNeeded(next: (error?: mongoose.CallbackError) => void, user: IUser) {
    if (!user.isModified?.("password")) return next();
    if (isBcryptHash(user.password)) return next();
    try {
        user.password = await PasswordUtils.hashPassword(user.password!);
        return next();
    } catch (e: CallbackError | unknown) {
        return next(e as CallbackError);
    }
}

userSchema.pre("save", function (next) {
    return hashIfNeeded(next, this as IUser);
});

userSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate() as mongoose.UpdateQuery<IUser>;
    if (!update) return next();

    const newPassword = update.password ?? update.$set?.password;
    if (!newPassword) return next();
    if (isBcryptHash(newPassword)) return next();

    try {
        const hashed = await PasswordUtils.hashPassword(newPassword);
        if (update.password) update.password = hashed;
        if (update.$set?.password) update.$set.password = hashed;
        return next();
    } catch (e: unknown) {
        return next(e as CallbackError);
    }
});

export const UserModel = mongoose.model<IUser>("User", userSchema);

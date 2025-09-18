import "dotenv/config";
import mongoose, {Schema, Document} from "mongoose";
import {PasswordUtils} from "../../utils/passwordUtils";

export interface IUser extends Document {
    name: string;
    password?: string;
    uuid: string;
    config: UserConfig;
    lastState?: MatrixState;
    spotifyConfig?: SpotifyConfig;
    timezone: string;
    location: string;
}

export interface UserConfig {
    isVisible: boolean;
    canBeModified: boolean;
    isAdmin: boolean;
}

export interface MatrixState {
    global: {
        mode: 'image' | 'text' | "idle" | "music" | "clock";
        brightness: number;
    };
    text: {
        text: string;
        align: 'left' | 'center' | 'right';
        speed: number;
        size: number;
        color: [number, number, number];
    };
    image: {
        image: string;
    };
    clock: {
        color: [number, number, number];
    };
    music: {
        fullscreen: boolean;
    };
}

export interface SpotifyConfig {
    accessToken: string;
    refreshToken: string;
    expirationDate: Date;
    scope: string;
}

const matrixStateSchema = new Schema({
    global: {
        mode: {type: String, enum: ['image', 'text', 'idle', 'music', 'clock'], default: 'idle'},
        brightness: {type: Number, min: 0, max: 100, default: 50},
    },
    text: {
        text: {type: String, default: ""},
        align: {type: String, enum: ['left', 'center', 'right'], default: 'center'},
        speed: {type: Number, min: 0, max: 10, default: 3},
        size: {type: Number, min: 1, max: 64, default: 12},
        color: {
            type: [Number],
            validate: {
                validator: (v: number[]) =>
                    Array.isArray(v) && v.length === 3 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 255),
                message: "color must be an array of three integers between 0 and 255",
            },
            default: [255, 255, 255],
        },
    },
    image: {
        image: {type: String, default: ""},
    },
    clock: {
        color: {
            type: [Number],
            validate: {
                validator: (v: number[]) =>
                    Array.isArray(v) && v.length === 3 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 255),
                message: "color must be an array of three integers between 0 and 255",
            },
            default: [255, 255, 255],
        },
    },
    music: {
        fullscreen: {type: Boolean, default: false},
    },
}, {_id: false});

const spotifyConfigSchema = new Schema({
    accessToken: {type: String},
    refreshToken: {type: String},
    expirationDate: {type: Date},
    scope: {type: String},
}, {_id: false});

const userConfigSchema = new Schema({
    isVisible: {type: Boolean, required: true},
    canBeModified: {type: Boolean, required: true},
    isAdmin: {type: Boolean, required: true},
}, {_id: false});

const userSchema = new Schema({
    name: {type: String, required: true, index: true},
    password: {type: String, required: true, select: false},
    uuid: {type: String, required: true, unique: true, index: true},
    config: {type: userConfigSchema, required: true},
    lastState: {type: matrixStateSchema},
    spotifyConfig: {type: spotifyConfigSchema},
    timezone: {type: String, required: true},
    location: {type: String, required: true},
}, {
    optimisticConcurrency: true,
    timestamps: true,
});

userSchema.virtual("id").get(function (this: any) {
    return this._id?.toHexString?.() ?? this._id;
});

function isBcryptHash(value: unknown): boolean {
    return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function hashIfNeeded(next: Function, user: any) {
    if (!user.isModified?.("password")) return next();
    if (isBcryptHash(user.password)) return next();
    try {
        user.password = await PasswordUtils.hashPassword(user.password)
        return next();
    } catch (e) {
        return next(e);
    }
}

userSchema.pre("save", function (next) {
    return hashIfNeeded(next, this);
});

userSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate() as any;
    if (!update) return next();

    const newPassword = update.password ?? update.$set?.password;
    if (!newPassword) return next();
    if (isBcryptHash(newPassword)) return next();

    try {
        const hashed = await PasswordUtils.hashPassword(newPassword);
        if (update.password) update.password = hashed;
        if (update.$set?.password) update.$set.password = hashed;
        return next();
    } catch (e: Error | any) {
        return next(e);
    }
});

export const UserModel = mongoose.model<IUser>('User', userSchema);

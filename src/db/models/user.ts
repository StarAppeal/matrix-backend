import "dotenv/config";
import mongoose, {Schema} from "mongoose";
import {ObjectId} from "mongodb";

export interface IUser {
    id: ObjectId;
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

const matrixStateSchema = new Schema<MatrixState>({
    global: {
        mode: {type: String, enum: ['image', 'text', 'idle', 'music', 'clock']},
        brightness: {type: Number},
    },
    text: {
        text: {type: String},
        align: {type: String, enum: ['left', 'center', 'right']},
        speed: {type: Number},
        size: {type: Number},
        color: {type: [Number]},
    },
    image: {
        image: {type: String},
    },
    clock: {
        color: {type: [Number]},
    },
    music: {
        fullscreen: {type: Boolean},
    },
}, {_id: false});

const spotifyConfigSchema = new Schema<SpotifyConfig>({
    accessToken: {type: String},
    refreshToken: {type: String},
    expirationDate: {type: Date},
    scope: {type: String},
}, {_id: false});

const userConfigSchema = new Schema<UserConfig>({
    isVisible: {type: Boolean, required: true},
    canBeModified: {type: Boolean, required: true},
    isAdmin: {type: Boolean, required: true},
}, {_id: false});

const userSchema = new Schema<IUser>({
    name: {type: String, required: true},
    password: {type: String, required: true},
    uuid: {type: String, required: true},
    config: {type: userConfigSchema, required: true},
    lastState: {type: matrixStateSchema},
    spotifyConfig: {type: spotifyConfigSchema},
    timezone: {type: String, required: true},
    location: {type: String, required: true},
}, {optimisticConcurrency: true});

export const UserModel = mongoose.model<IUser>('User', userSchema);

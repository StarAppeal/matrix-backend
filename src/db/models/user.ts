import "dotenv/config";

import {ObjectId} from "mongodb";
import mongoose from "mongoose";


export interface IUser {
    name: string,
    uuid: string,
    id: ObjectId,
    config: UserConfig,
    lastState: MatrixState
}

export interface UserConfig {
    isVisible: boolean,
    canBeModified: boolean,
    isAdmin: boolean
}

export interface MatrixState {
    global: {
        mode: 'image' | 'text' | "idle" | "music" | "clock";
        brightness: number;
    };
    text: {
        text: string;
        align: 'left' | 'center' | 'right'; // Annahme: Mögliche Ausrichtungen sind 'left', 'center', 'right'
        speed: number;
        size: number;
        color: [number, number, number]; // RGB-Werte
    };
    image: {
        image: string; // Der Name der Bilddatei
    };
    clock: {
        color: [number, number, number]; // RGB-Werte
    };
    music: {
        fullscreen: boolean;
    };
}

const userSchema = new mongoose.Schema<IUser>({
    name: {
        type: String,
        required: true,
    },
    uuid: {
        type: String,
        required: true,
    },
    config: {
        isVisible: {
            type: Boolean,
            required: true,
        },
        canBeModified: {
            type: Boolean,
            required: true,
        },
        isAdmin: {
            type: Boolean,
            required: true,
        },
    },
    lastState: {
        global: {
            mode: {
                type: String,
                required: true,
            },
            brightness: {
                type: Number,
                required: true,
            },
        },
        text: {
            text: {
                type: String,
                required: true,
            },
            align: {
                type: String,
                required: true,
            },
            speed: {
                type: Number,
                required: true,
            },
            size: {
                type: Number,
                required: true,
            },
            color: {
                type: [Number],
                required: true,
            },
        },
        image: {
            image: {
                type: String,
                required: true,
            },
        },
        clock: {
            color: {
                type: [Number],
                required: true,
            },
        },
        music: {
            fullscreen: {
                type: Boolean,
                required: true,
            }
        }
    },
});


export const UserModel = mongoose.model<IUser>(process.env.USER_COLLECTION_NAME!, userSchema);

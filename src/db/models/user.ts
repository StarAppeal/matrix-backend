import "dotenv/config";

import {ObjectId} from "mongodb";
import mongoose from "mongoose";


export interface IUser {
    name: string,
    uuid: string,
    id: ObjectId,
    config: UserConfig
}

export interface UserConfig {
    isVisible: boolean,
    canBeModified: boolean,
    isAdmin: boolean
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
});


export const UserModel = mongoose.model<IUser>(process.env.USER_COLLECTION_NAME!, userSchema);

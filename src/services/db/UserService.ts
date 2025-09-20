import {connectToDatabase} from "./database.service";
import { UpdateQuery} from "mongoose";
import {CreateUserPayload, IUser, SpotifyConfig, UserModel} from "../../db/models/user";

export class UserService {
    private static _instance: UserService;

    private constructor() {
    }

    public static async create(): Promise<UserService> {
        if (!this._instance) {
            await connectToDatabase();
            this._instance = new UserService();
        }
        return this._instance;
    }

    public async updateUserById(id: string, user: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(id, user, {
            new: true,
        }).exec();
    }

    public async updateUserByUUID(uuid: string, updates: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findOneAndUpdate(
            { uuid: uuid },
            { $set: updates },
            { new: true }
        ).exec();
    }

    public async getAllUsers(): Promise<IUser[]> {
        return await UserModel.find({}, {spotifyConfig: 0, lastState: 0}).exec();
    }

    public async getUserById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id).exec();
    }

    public async getUserByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOne({uuid}).exec();
    }

    public async getUserByName(name: string): Promise<IUser | null> {
        return await UserModel.findOne({name})
            .collation({locale: "en", strength: 2})
            .exec();
    }

    public async getUserAuthByName(name: string): Promise<IUser | null> {
        return await UserModel.findOne({name})
            .collation({locale: "en", strength: 2})
            .select("+password")
            .exec();
    }


    public async getSpotifyConfigByUUID(uuid: string): Promise<SpotifyConfig | undefined> {
        return await UserModel.findOne({uuid}, {spotifyConfig: 1}).exec().then(user => user?.spotifyConfig);
    }

    public async createUser(userData: CreateUserPayload): Promise<IUser> {
        try {
            const newUser = await UserModel.create(userData);

            const userObject = newUser.toObject();
            delete userObject.password;

            return userObject as IUser;

        } catch (error: any) {
            if (error.code === 11000 && error.keyPattern?.uuid) {
                throw new Error("User with that uuid already exists");
            }

            if (error.name === 'ValidationError') {
                throw new Error(`ValidationError: ${error.message}`);
            }

            console.error("Error creating user:", error);
            throw new Error("User could not be created.");
        }
    }

    public async existsUserByName(name: string): Promise<boolean> {
        return (await UserModel.countDocuments({ name })) > 0;
    }

    public async clearSpotifyConfigByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOneAndUpdate(
            { uuid },
            { $unset: { spotifyConfig: 1 } } as UpdateQuery<IUser>,
            { new: true }
        ).exec();
    }


}

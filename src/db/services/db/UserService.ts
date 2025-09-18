import {IUser, SpotifyConfig, UserModel} from "../../models/user";
import {connectToDatabase} from "./database.service";
import {UpdateQuery} from "mongoose";

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

    public async updateUser(user: IUser): Promise<IUser | null> {
        const anyUser = user as any;
        const targetId: string | undefined = anyUser?.id?.toString?.() ?? anyUser?._id?.toString?.();

        if (!targetId) {
            throw new Error("updateUser requires user.id or user._id");
        }

        const { id, _id, ...rest } = anyUser;

        return this.updateUserById(targetId, rest as Partial<IUser>);
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

    public async createUser(user: IUser): Promise<IUser> {
        const createdUser = await UserModel.create(user);

        const {password, ...rest} = createdUser.toObject();
        return rest as IUser;
    }

    public async existsUserByName(name: string): Promise<boolean> {
        return !!(await UserModel.findOne({name}).exec());
    }

    public async clearSpotifyConfigByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOneAndUpdate(
            { uuid },
            { $unset: { spotifyConfig: 1 } } as UpdateQuery<IUser>,
            { new: true }
        ).exec();
    }


}

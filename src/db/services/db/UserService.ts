import {IUser, SpotifyConfig, UserModel} from "../../models/user";
import {connectToDatabase} from "./database.service";

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
            projection: {password: 0},
        }).exec();
    }

    public async updateUser(user: IUser): Promise<IUser | null> {
        const {id, ...rest} = user;
        return this.updateUserById(id.toString(), rest);
    }

    public async getAllUsers(): Promise<IUser[]> {
        return await UserModel.find({}, {password: 0, spotifyConfig: 0, lastState: 0}).exec();
    }

    public async getUserById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id, {password: 0}).exec();
    }

    public async getUserByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOne({uuid}, {password: 0}).exec();
    }

    public async getUserByName(name: string): Promise<IUser | null> {
        return await UserModel.findOne({name})
            .collation({locale: "en", strength: 2})
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

}

import {IUser, UserModel} from "../../models/user";
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
        return await UserModel.findByIdAndUpdate(id, user, {new: true}).exec();
    }

    public async updateUser(user: IUser): Promise<IUser | null> {
        const {id, ...rest} = user;
        return this.updateUserById(id.toString(), rest);
    }

    public async getAllUsers(): Promise<IUser[]> {
        return await UserModel.find().exec();
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

    public async createUser(user: IUser): Promise<IUser> {
        return await UserModel.create(user);
    }
}

import { UserModel, IUser } from "../models/user";
import {connectToDatabase} from "./database.service";

export class UserService {
    private static _instance: UserService;

    private constructor() {}

    public static async create(): Promise<UserService> {
        if (!this._instance) {
            await connectToDatabase();
            this._instance = new UserService();
        }
        return this._instance;
    }

    public async updateUser(id: string, user: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(id, user, { new: true }).exec();
    }

    public async getAllUsers(): Promise<IUser[]> {
        return await UserModel.find().exec();
    }

    public async getUserById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id).exec();
    }
}

import { CreateUserPayload, IUser, UserModel } from "../../db/models/user";
import logger from "../../utils/logger";

interface MongooseError extends Error {
    code?: number;
    keyPattern?: { [key: string]: number | boolean | string };
    name: string;
}

export class UserService {
    public async updateUserById(id: string, user: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(id, user, {
            new: true,
        }).exec();
    }

    public async updateUserByUUID(uuid: string, updates: Partial<IUser>): Promise<IUser | null> {
        return await UserModel.findOneAndUpdate({ uuid: uuid }, { $set: updates }, { new: true }).exec();
    }

    public async getAllUsers(): Promise<IUser[]> {
        return await UserModel.find({ isDeleted: { $ne: true } }).exec();
    }

    public async getAllUsersIncludingDeleted(): Promise<IUser[]> {
        return await UserModel.find({}).exec();
    }

    public async getUserById(id: string): Promise<IUser | null> {
        return await UserModel.findById(id).exec();
    }

    public async getUserByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOne({ uuid, isDeleted: { $ne: true } }).exec();
    }

    public async getUserByName(name: string): Promise<IUser | null> {
        return await UserModel.findOne({ name, isDeleted: { $ne: true } }).collation({ locale: "en", strength: 2 }).exec();
    }

    public async getUserAuthByName(name: string): Promise<IUser | null> {
        return await UserModel.findOne({ name, isDeleted: { $ne: true } }).collation({ locale: "en", strength: 2 }).select("+password").exec();
    }

    public async createUser(userData: CreateUserPayload): Promise<IUser> {
        try {
            const newUser = await UserModel.create(userData);

            const userObject = newUser.toObject();
            delete userObject.password;

            return userObject as IUser;
        } catch (error: unknown) {
            const mongoError = error as MongooseError;

            if (mongoError.code === 11000 && mongoError.keyPattern?.uuid) {
                throw new Error("User with that uuid already exists");
            }

            if (mongoError.name === "ValidationError") {
                throw new Error(`ValidationError: ${mongoError.message}`);
            }

            logger.error("Error creating user:", error);
            throw new Error("User could not be created.");
        }
    }

    public async existsUserByName(name: string): Promise<boolean> {
        return (await UserModel.countDocuments({ name, isDeleted: { $ne: true } })) > 0;
    }

    public async clearLastFmUsernameByUUID(uuid: string): Promise<IUser | null> {
        return await UserModel.findOneAndUpdate({ uuid }, { $unset: { lastFmUsername: 1 } }, { new: true }).exec();
    }

    public async softDeleteUser(id: string): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(
            id,
            { $set: { isDeleted: true, deletedAt: new Date() } },
            { new: true }
        ).exec();
    }

    public async restoreUser(id: string): Promise<IUser | null> {
        return await UserModel.findByIdAndUpdate(
            id,
            { $set: { isDeleted: false }, $unset: { deletedAt: 1 } },
            { new: true }
        ).exec();
    }

    public async countUsers(): Promise<number> {
        return await UserModel.countDocuments({ isDeleted: { $ne: true } }).exec();
    }

    public async countDeletedUsers(): Promise<number> {
        return await UserModel.countDocuments({ isDeleted: true }).exec();
    }

    public async countAdmins(): Promise<number> {
        return await UserModel.countDocuments({ "config.isAdmin": true, isDeleted: { $ne: true } }).exec();
    }
}

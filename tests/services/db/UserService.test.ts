import { describe, it, expect, vi, beforeEach } from "vitest";
import {UserModel} from "../../../src/db/models/user";
import {UserService} from "../../../src/services/db/UserService";
import {connectToDatabase} from "../../../src/services/db/database.service";

vi.mock("../../../src/services/db/database.service", () => ({
    connectToDatabase: vi.fn(),
}));

vi.mock("../../../src/db/models/user");

const mockedUserModel = vi.mocked(UserModel);
const mockedConnectToDatabase = vi.mocked(connectToDatabase);

const createMockMongooseQuery = (resolveValue: any) => {
    const exec = vi.fn().mockResolvedValue(resolveValue);
    const select = vi.fn().mockReturnValue({ exec });
    const collation = vi.fn().mockReturnValue({ select, exec });
    return { exec, select, collation };
};

describe("UserService", () => {
    let userService: UserService;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockedConnectToDatabase.mockResolvedValue(undefined);

        (UserService as any)._instance = undefined;
        userService = await UserService.create();
    });

    describe("create (singleton)", () => {
        it("should create a singleton instance", async () => {
            const instance1 = userService;
            const instance2 = await UserService.create();

            expect(instance1).toBe(instance2);
        });

        it("should connect to database only on first creation", async () => {

            await UserService.create();
            await UserService.create();

            expect(mockedConnectToDatabase).toHaveBeenCalledTimes(1);
        });
    });

    describe("updateUserById", () => {
        it("should update user by id and return updated user without password", async () => {
            const userId = "507f1f77bcf86cd799439011";
            const updateData = { name: "Updated Name" };
            const updatedUser = { _id: userId, name: "Updated Name", email: "test@example.com" };

            mockedUserModel.findByIdAndUpdate.mockReturnValue(createMockMongooseQuery(updatedUser) as any);

            const result = await userService.updateUserById(userId, updateData);

            expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                userId,
                updateData,
                { new: true }
            );
            expect(result).toEqual(updatedUser);
        });

        it("should return null if user not found", async () => {
            mockedUserModel.findByIdAndUpdate.mockReturnValue(createMockMongooseQuery(null) as any);

            const result = await userService.updateUserById("some-id", { name: "Updated Name" });

            expect(result).toBeNull();
        });
    });

    describe("getAllUsers", () => {
        it("should return all users without sensitive fields", async () => {
            const users = [{ name: "User1" }, { name: "User2" }];
            mockedUserModel.find.mockReturnValue(createMockMongooseQuery(users) as any);

            const result = await userService.getAllUsers();

            expect(mockedUserModel.find).toHaveBeenCalledWith({}, { spotifyConfig: 0, lastState: 0 });
            expect(result).toEqual(users);
        });
    });

    describe("getUserById", () => {
        it("should return user by id", async () => {
            const user = { _id: "user1", name: "Test User" };
            mockedUserModel.findById.mockReturnValue(createMockMongooseQuery(user) as any);

            const result = await userService.getUserById("user1");

            expect(mockedUserModel.findById).toHaveBeenCalledWith("user1");
            expect(result).toEqual(user);
        });

        it("should return null if user not found", async () => {
            mockedUserModel.findById.mockReturnValue(createMockMongooseQuery(null) as any);

            const result = await userService.getUserById("non-existent-id");

            expect(result).toBeNull();
        });
    });

    describe("getUserByUUID", () => {
        it("should return user by UUID", async () => {
            const user = { uuid: "uuid-123", name: "Test User" };
            mockedUserModel.findOne.mockReturnValue(createMockMongooseQuery(user) as any);

            const result = await userService.getUserByUUID("uuid-123");

            expect(mockedUserModel.findOne).toHaveBeenCalledWith({ uuid: "uuid-123" });
            expect(result).toEqual(user);
        });
    });

    describe("getUserByName", () => {
        it("should return user by name with case-insensitive search", async () => {
            const user = { name: "TestUser" };
            const mockQuery = createMockMongooseQuery(user);
            mockedUserModel.findOne.mockReturnValue(mockQuery as any);

            const result = await userService.getUserByName("TestUser");

            expect(mockedUserModel.findOne).toHaveBeenCalledWith({ name: "TestUser" });
            expect(mockQuery.collation).toHaveBeenCalledWith({ locale: "en", strength: 2 });
            expect(result).toEqual(user);
        });
    });

    describe("getUserAuthByName", () => {
        it("should return user with password for authentication", async () => {
            const user = { name: "TestUser", password: "hashedPassword" };
            const mockQuery = createMockMongooseQuery(user);
            mockedUserModel.findOne.mockReturnValue(mockQuery as any);

            const result = await userService.getUserAuthByName("TestUser");

            expect(mockedUserModel.findOne).toHaveBeenCalledWith({ name: "TestUser" });
            expect(mockQuery.collation).toHaveBeenCalledWith({ locale: "en", strength: 2 });
            expect(mockQuery.select).toHaveBeenCalledWith("+password");
            expect(result).toEqual(user);
        });
    });

    describe("getSpotifyConfigByUUID", () => {
        it("should return spotify config for user", async () => {
            const spotifyConfig = { accessToken: "access-token" };
            mockedUserModel.findOne.mockReturnValue(createMockMongooseQuery({ spotifyConfig }) as any);

            const result = await userService.getSpotifyConfigByUUID("uuid-123");

            expect(mockedUserModel.findOne).toHaveBeenCalledWith({ uuid: "uuid-123" }, { spotifyConfig: 1 });
            expect(result).toEqual(spotifyConfig);
        });

        it("should return undefined if user has no spotify config", async () => {
            mockedUserModel.findOne.mockReturnValue(createMockMongooseQuery(null) as any);

            const result = await userService.getSpotifyConfigByUUID("uuid-123");

            expect(result).toBeUndefined();
        });
    });

    describe("createUser", () => {
        it("should create user and return without password", async () => {
            const userData = { name: "New User", password: "hashedPassword", uuid: "new-uuid" };
            const createdUserWithPassword = { ...userData, _id: "newUser1" };
            const createdUserDocument = {
                ...createdUserWithPassword,
                toObject: () => createdUserWithPassword,
            };
            mockedUserModel.create.mockResolvedValue(createdUserDocument as any);

            const result = await userService.createUser(userData as any)

            expect(mockedUserModel.create).toHaveBeenCalledWith(userData);
            expect(result).not.toHaveProperty("password");
            expect(result.name).toBe("New User");
            // @ts-ignore
            expect(result._id).toBe("newUser1");
        });
    });

    describe("existsUserByName", () => {
        it("should return true if user exists", async () => {
            // @ts-ignore
            mockedUserModel.countDocuments.mockReturnValue(1);

            const result = await userService.existsUserByName("ExistingUser");

            expect(mockedUserModel.countDocuments).toHaveBeenCalledWith({ name: "ExistingUser" });
            expect(result).toBe(true);
        });

        it("should return false if user does not exist", async () => {
            // @ts-ignore
            mockedUserModel.countDocuments.mockReturnValue(0);

            const result = await userService.existsUserByName("NonExistentUser");

            expect(result).toBe(false);
        });
    });

    describe("clearSpotifyConfigByUUID", () => {
        it("should clear spotify config and return updated user", async () => {
            const updatedUser = { uuid: "uuid-123", name: "Test User" };
            mockedUserModel.findOneAndUpdate.mockReturnValue(createMockMongooseQuery(updatedUser) as any);

            const result = await userService.clearSpotifyConfigByUUID("uuid-123");

            expect(mockedUserModel.findOneAndUpdate).toHaveBeenCalledWith(
                { uuid: "uuid-123" },
                { $unset: { spotifyConfig: 1 } },
                { new: true }
            );
            expect(result).toEqual(updatedUser);
        });

        it("should return null if user not found", async () => {
            mockedUserModel.findOneAndUpdate.mockReturnValue(createMockMongooseQuery(null) as any);

            const result = await userService.clearSpotifyConfigByUUID("non-existent-uuid");

            expect(result).toBeNull();
        });
    });
});
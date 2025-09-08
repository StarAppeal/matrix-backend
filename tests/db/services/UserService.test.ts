import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserService } from "../../../src/db/services/db/UserService";
import { UserModel, IUser, SpotifyConfig } from "../../../src/db/models/user";
import { connectToDatabase } from "../../../src/db/services/db/database.service";

vi.mock("../../../src/db/services/db/database.service", () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock("../../../src/db/models/user", () => ({
  UserModel: {
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
  SpotifyConfig: {},
}));

const mockedUserModel = vi.mocked(UserModel);
const mockedConnectToDatabase = vi.mocked(connectToDatabase);

describe("UserService", () => {
  let userService: UserService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedConnectToDatabase.mockResolvedValue(undefined);
    userService = await UserService.create();
  });

  afterEach(() => {
    (UserService as any)._instance = undefined;
  });

  describe("create (singleton)", () => {
    it("should create a singleton instance", async () => {
      const instance1 = await UserService.create();
      const instance2 = await UserService.create();

      expect(instance1).toBe(instance2);
      expect(mockedConnectToDatabase).toHaveBeenCalledTimes(1);
    });

    it("should connect to database on first creation", async () => {
      await UserService.create();

      expect(mockedConnectToDatabase).toHaveBeenCalledOnce();
    });
  });

  describe("updateUserById", () => {
    it("should update user by id and return updated user without password", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const updateData = { name: "Updated Name" };
      const updatedUser = { _id: userId, name: "Updated Name", email: "test@example.com" };

      const mockExec = vi.fn().mockResolvedValue(updatedUser);
      mockedUserModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.updateUserById(userId, updateData);

      expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        updateData,
        {
          new: true,
          projection: { password: 0 },
        }
      );
      expect(result).toEqual(updatedUser);
    });

    it("should return null if user not found", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const updateData = { name: "Updated Name" };

      const mockExec = vi.fn().mockResolvedValue(null);
      mockedUserModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.updateUserById(userId, updateData);

      expect(result).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("should update user using id field", async () => {
      const user = { id: "507f1f77bcf86cd799439011", name: "Test User" } as any;
      const updatedUser = { _id: user.id, name: "Test User" };

      const mockExec = vi.fn().mockResolvedValue(updatedUser);
      mockedUserModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.updateUser(user);

      expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        user.id,
        { name: "Test User" },
        {
          new: true,
          projection: { password: 0 },
        }
      );
      expect(result).toEqual(updatedUser);
    });

    it("should update user using _id field", async () => {
      const user = { _id: "507f1f77bcf86cd799439011", name: "Test User" } as any;
      const updatedUser = { _id: user._id, name: "Test User" };

      const mockExec = vi.fn().mockResolvedValue(updatedUser);
      mockedUserModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.updateUser(user);

      expect(mockedUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        user._id,
        { name: "Test User" },
        {
          new: true,
          projection: { password: 0 },
        }
      );
      expect(result).toEqual(updatedUser);
    });

    it("should throw error if user has no id or _id", async () => {
      const user = { name: "Test User" } as any;

      await expect(userService.updateUser(user)).rejects.toThrow(
        "updateUser requires user.id or user._id"
      );
    });
  });

  describe("getAllUsers", () => {
    it("should return all users without sensitive fields", async () => {
      const users = [
        { _id: "1", name: "User1", email: "user1@example.com" },
        { _id: "2", name: "User2", email: "user2@example.com" },
      ];

      const mockExec = vi.fn().mockResolvedValue(users);
      mockedUserModel.find.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getAllUsers();

      expect(mockedUserModel.find).toHaveBeenCalledWith(
        {},
        { spotifyConfig: 0, lastState: 0 }
      );
      expect(result).toEqual(users);
    });
  });

  describe("getUserById", () => {
    it("should return user by id", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const user = { _id: userId, name: "Test User" };

      const mockExec = vi.fn().mockResolvedValue(user);
      mockedUserModel.findById.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getUserById(userId);

      expect(mockedUserModel.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(user);
    });

    it("should return null if user not found", async () => {
      const userId = "507f1f77bcf86cd799439011";

      const mockExec = vi.fn().mockResolvedValue(null);
      mockedUserModel.findById.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe("getUserByUUID", () => {
    it("should return user by UUID", async () => {
      const uuid = "test-uuid-123";
      const user = { _id: "507f1f77bcf86cd799439011", uuid, name: "Test User" };

      const mockExec = vi.fn().mockResolvedValue(user);
      mockedUserModel.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getUserByUUID(uuid);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({ uuid });
      expect(result).toEqual(user);
    });
  });

  describe("getUserByName", () => {
    it("should return user by name with case-insensitive search", async () => {
      const name = "TestUser";
      const user = { _id: "507f1f77bcf86cd799439011", name, email: "test@example.com" };

      const mockExec = vi.fn().mockResolvedValue(user);
      const mockCollation = vi.fn().mockReturnValue({ exec: mockExec });
      mockedUserModel.findOne.mockReturnValue({ collation: mockCollation } as any);

      const result = await userService.getUserByName(name);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({ name });
      expect(mockCollation).toHaveBeenCalledWith({ locale: "en", strength: 2 });
      expect(result).toEqual(user);
    });
  });

  describe("getUserAuthByName", () => {
    it("should return user with password for authentication", async () => {
      const name = "TestUser";
      const user = { _id: "507f1f77bcf86cd799439011", name, password: "hashedPassword" };

      const mockExec = vi.fn().mockResolvedValue(user);
      const mockSelect = vi.fn().mockReturnValue({ exec: mockExec });
      const mockCollation = vi.fn().mockReturnValue({ select: mockSelect });
      mockedUserModel.findOne.mockReturnValue({ collation: mockCollation } as any);

      const result = await userService.getUserAuthByName(name);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({ name });
      expect(mockCollation).toHaveBeenCalledWith({ locale: "en", strength: 2 });
      expect(mockSelect).toHaveBeenCalledWith("+password");
      expect(result).toEqual(user);
    });
  });

  describe("getSpotifyConfigByUUID", () => {
    it("should return spotify config for user", async () => {
      const uuid = "test-uuid-123";
      const spotifyConfig: SpotifyConfig = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
          expirationDate: new Date(),
          scope: "user-read-playback-state",
      };
      const user = { spotifyConfig };

      const mockExec = vi.fn().mockResolvedValue(user);
      mockedUserModel.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getSpotifyConfigByUUID(uuid);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith(
        { uuid },
        { spotifyConfig: 1 }
      );
      expect(result).toEqual(spotifyConfig);
    });

    it("should return undefined if user has no spotify config", async () => {
      const uuid = "test-uuid-123";

      const mockExec = vi.fn().mockResolvedValue(null);
      mockedUserModel.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.getSpotifyConfigByUUID(uuid);

      expect(result).toBeUndefined();
    });
  });

  describe("createUser", () => {
    it("should create user and return without password", async () => {
      const userData: Partial<IUser> = {
        name: "New User",
        email: "new@example.com",
        password: "hashedPassword",
        uuid: "new-uuid",
      } as Partial<IUser>;

      const createdUser = {
        ...userData,
        _id: "507f1f77bcf86cd799439011",
        toObject: vi.fn().mockReturnValue({
          ...userData,
          _id: "507f1f77bcf86cd799439011",
        }),
      };

      mockedUserModel.create.mockResolvedValue(createdUser as any);

      const result = await userService.createUser(userData as any);

      expect(mockedUserModel.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual({
        name: "New User",
        email: "new@example.com",
        uuid: "new-uuid",
        _id: "507f1f77bcf86cd799439011",
      });
      expect(result).not.toHaveProperty("password");
    });
  });

  describe("existsUserByName", () => {
    it("should return true if user exists", async () => {
      const name = "ExistingUser";
      const user = { _id: "507f1f77bcf86cd799439011", name };

      const mockExec = vi.fn().mockResolvedValue(user);
      mockedUserModel.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.existsUserByName(name);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({ name });
      expect(result).toBe(true);
    });

    it("should return false if user does not exist", async () => {
      const name = "NonExistentUser";

      const mockExec = vi.fn().mockResolvedValue(null);
      mockedUserModel.findOne.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.existsUserByName(name);

      expect(result).toBe(false);
    });
  });

  describe("clearSpotifyConfigByUUID", () => {
    it("should clear spotify config and return updated user", async () => {
      const uuid = "test-uuid-123";
      const updatedUser = { _id: "507f1f77bcf86cd799439011", uuid, name: "Test User" };

      const mockExec = vi.fn().mockResolvedValue(updatedUser);
      mockedUserModel.findOneAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.clearSpotifyConfigByUUID(uuid);

      expect(mockedUserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { uuid },
        { $unset: { spotifyConfig: 1 } },
        { new: true, projection: { password: 0 } }
      );
      expect(result).toEqual(updatedUser);
    });

    it("should return null if user not found", async () => {
      const uuid = "non-existent-uuid";

      const mockExec = vi.fn().mockResolvedValue(null);
      mockedUserModel.findOneAndUpdate.mockReturnValue({ exec: mockExec } as any);

      const result = await userService.clearSpotifyConfigByUUID(uuid);

      expect(result).toBeNull();
    });
  });
});
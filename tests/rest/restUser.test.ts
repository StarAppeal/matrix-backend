import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import request from "supertest";

import {RestUser} from "../../src/rest/restUser";
// @ts-ignore
import {createMockUserService, setupTestEnvironment, type TestEnvironment} from "../helpers/testSetup";
import { Types } from "mongoose";

vi.mock("../../src/services/db/UserService", () => ({
    UserService: {
        create: vi.fn()
    }
}));

vi.mock("../../src/utils/passwordUtils", () => ({
    PasswordUtils: {
        validatePassword: vi.fn(),
        hashPassword: vi.fn(),
        comparePassword: vi.fn()
    }
}));

describe("RestUser", () => {
    let testEnv: TestEnvironment;

    const requestingUserUUID = "test-user-uuid";
    const adminUser = {uuid: requestingUserUUID, config: {isAdmin: true}};
    const nonAdminUser = {uuid: requestingUserUUID, config: {isAdmin: false}};
    const mockedUserService = createMockUserService();

    beforeEach(() => {
        vi.clearAllMocks();

        const restUser = new RestUser(mockedUserService);
        testEnv = setupTestEnvironment(restUser.createRouter(), "/user");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("GET /me", () => {
        it("should return current user", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid"
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .get("/user/me")
                .expect(200);

            expect(response.body.data).toEqual(mockUser);
            expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith("test-user-uuid");
        });
    });

    describe("PUT /me/spotify", () => {
        const validSpotifyData = {
            accessToken: "access-token-123",
            refreshToken: "refresh-token-123",
            scope: "user-read-playback-state",
            expirationDate: "2024-12-31T23:59:59.000Z"
        };

        it("should update user spotify config successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                spotifyConfig: null
            };

            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(validSpotifyData)
                .expect(200);

            expect(response.body.data.message).toBe("Spotify config changed successfully.");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith(
                mockUser.uuid, {
                    spotifyConfig: {
                        accessToken: "access-token-123",
                        refreshToken: "refresh-token-123",
                        scope: "user-read-playback-state",
                        expirationDate: new Date("2024-12-31T23:59:59.000Z")
                    }
                });
        });

        it("should return bad request for missing accessToken", async () => {
            const invalidData: Partial<typeof validSpotifyData> = {...validSpotifyData};
            delete invalidData.accessToken;

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("accessToken");
        });

        it("should return bad request for missing refreshToken", async () => {
            const invalidData: Partial<typeof validSpotifyData> = {...validSpotifyData};
            delete invalidData.refreshToken;

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("refreshToken");
        });

        it("should return bad request for missing scope", async () => {
            const invalidData: Partial<typeof validSpotifyData> = {...validSpotifyData};
            delete invalidData.scope;

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("scope");
        });

        it("should return bad request for missing expirationDate", async () => {
            const invalidData: Partial<typeof validSpotifyData> = {...validSpotifyData};
            delete invalidData.expirationDate;

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("expirationDate");
        });

        it("should return bad request for empty accessToken", async () => {
            const invalidData = {...validSpotifyData, accessToken: ""};

            const response = await request(testEnv.app)
                .put("/user/me/spotify")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("accessToken");
        });
    });

    describe("DELETE /me/spotify", () => {
        it("should clear spotify config successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid"
            };

            const updatedUser = {
                ...mockUser,
                spotifyConfig: null
            };

            mockedUserService.clearSpotifyConfigByUUID.mockResolvedValue(updatedUser);

            const response = await request(testEnv.app)
                .delete("/user/me/spotify")
                .expect(200);

            expect(response.body.data.user).toEqual(updatedUser);
            expect(mockedUserService.clearSpotifyConfigByUUID).toHaveBeenCalledWith("test-user-uuid");
        });
    });

    describe("PUT /me/state", () => {
        const validStateData = {
            lastState: {
                global: {
                    mode: "idle",
                    brightness: 50
                },
                text: {
                    text: "Hello",
                    align: "center",
                    speed: 3,
                    size: 12,
                    color: [255, 255, 255]
                },
                image: {
                    image: ""
                },
                clock: {
                    color: [255, 255, 255]
                },
                music: {
                    fullscreen: false
                }
            }
        };

        it("should update state successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid"
            };

            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send(validStateData)
                .expect(200);

            expect(response.body.data.message).toBe("State updated successfully.");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith(
                "test-user-uuid",
                { lastState: validStateData.lastState }
            );
        });

        it("should return bad request for missing lastState", async () => {
            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send({})
                .expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should return bad request for empty lastState object", async () => {
            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send({ lastState: {} })
                .expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should return bad request for null lastState", async () => {
            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send({ lastState: null })
                .expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should return bad request for non-object lastState", async () => {
            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send({ lastState: "not an object" })
                .expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should accept partial state updates", async () => {
            const partialState = {
                lastState: {
                    global: {
                        mode: "music",
                        brightness: 75
                    }
                }
            };

            mockedUserService.updateUserByUUID.mockResolvedValue({});

            const response = await request(testEnv.app)
                .put("/user/me/state")
                .send(partialState)
                .expect(200);

            expect(response.body.data.message).toBe("State updated successfully.");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith(
                "test-user-uuid",
                { lastState: partialState.lastState }
            );
        });
    });

    describe("PUT /me/password", () => {
        const validPasswordData = {
            password: "newpassword123",
            passwordConfirmation: "newpassword123"
        };

        it("should update password successfully", async () => {
            const {PasswordUtils} = await import("../../src/utils/passwordUtils");

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                password: "old-hashed-password"
            };

            vi.mocked(PasswordUtils.validatePassword).mockReturnValue({valid: true});
            vi.mocked(PasswordUtils.hashPassword).mockResolvedValue("new-hashed-password");
            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(validPasswordData)
                .expect(200);

            expect(response.body.data.message).toBe("Password changed successfully");
            expect(PasswordUtils.validatePassword).toHaveBeenCalledWith("newpassword123");
            expect(PasswordUtils.hashPassword).toHaveBeenCalledWith("newpassword123");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith(
                mockUser.uuid, {
                    password: "new-hashed-password"
                });
        });

        it("should return bad request when passwords don't match", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid"
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            const invalidData = {
                password: "newpassword123",
                passwordConfirmation: "differentpassword"
            };

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.message).toBe("Passwörter stimmen nicht überein");
        });

        it("should return bad request for invalid password", async () => {
            const {PasswordUtils} = await import("../../src/utils/passwordUtils");

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid"
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);
            vi.mocked(PasswordUtils.validatePassword).mockReturnValue({
                valid: false,
                message: "Password too weak"
            });

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(validPasswordData)
                .expect(400);

            expect(response.body.data.message).toBe("Password too weak");
        });

        it("should return bad request for missing password", async () => {
            const invalidData = {passwordConfirmation: "newpassword123"};

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("password");
        });

        it("should return bad request for missing passwordConfirmation", async () => {
            const invalidData = {password: "newpassword123"};

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("passwordConfirmation");
        });

        it("should return bad request for short password", async () => {
            const invalidData = {
                password: "short",
                passwordConfirmation: "short"
            };

            const response = await request(testEnv.app)
                .put("/user/me/password")
                .send(invalidData)
                .expect(400);

            expect(response.body.data.details[0]).toContain("password");
        });
    });

    describe("GET / (Admin only)", () => {

        describe("when user is an admin", () => {
            beforeEach(() => {
                mockedUserService.getUserByUUID.mockResolvedValue(adminUser);
            });

            it("should return all users", async () => {
                const mockUsers = [
                    {id: "1", name: "user1", uuid: "uuid1"},
                    {id: "2", name: "user2", uuid: "uuid2"}
                ];
                mockedUserService.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(testEnv.app)
                    .get("/user/")
                    .expect(200);

                expect(response.body.data.users).toEqual(mockUsers);
                expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(requestingUserUUID);
                expect(mockedUserService.getAllUsers).toHaveBeenCalled();
            });

            it("should handle empty user list", async () => {
                mockedUserService.getAllUsers.mockResolvedValue([]);

                const response = await request(testEnv.app)
                    .get("/user/")
                    .expect(200);

                expect(response.body.data.users).toEqual([]);
            });
        });

        describe("when user is not an admin", () => {
            it("should return 404 Not Found if user is not an admin", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(nonAdminUser);

                await request(testEnv.app)
                    .get("/user/")
                    .expect(404);
            });

            it("should return 404 Not Found if user does not exist", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(null);

                await request(testEnv.app)
                    .get("/user/")
                    .expect(404);
            });
        });
    });

    describe("GET /:id (Admin only)", () => {
        const specificUserId = new Types.ObjectId().toString();
        const mockUser = {
            id: specificUserId,
            name: "specificuser",
            uuid: "specific-uuid"
        };

        describe("when user is an admin", () => {
            beforeEach(() => {
                mockedUserService.getUserByUUID.mockResolvedValue(adminUser);
            });

            it("should return user by id", async () => {
                mockedUserService.getUserById.mockResolvedValue(mockUser);

                const response = await request(testEnv.app)
                    .get(`/user/${specificUserId}`)
                    .expect(200);

                expect(response.body.data).toEqual(mockUser);
                expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(requestingUserUUID);
                expect(mockedUserService.getUserById).toHaveBeenCalledWith(specificUserId);
            });

            it("should return bad request when target user is not found", async () => {
                mockedUserService.getUserById.mockResolvedValue(null);

                const nonExistentUserId = new Types.ObjectId().toString();
                const response = await request(testEnv.app)
                    .get(`/user/${nonExistentUserId}`)
                    .expect(400);

                expect(response.body.data.message).toBe(`Unable to find matching document with id: ${nonExistentUserId}`);
            });
        });

        describe("when user is not an admin", () => {
            it("should return 404 Not Found if user is not an admin", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(nonAdminUser);

                await request(testEnv.app)
                    .get(`/user/${specificUserId}`)
                    .expect(404);
            });

            it("should return 404 Not Found if user does not exist", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(null);

                await request(testEnv.app)
                    .get(`/user/${specificUserId}`)
                    .expect(404);
            });
        });

    });
});
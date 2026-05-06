import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

import { RestUser } from "../../src/rest/restUser";
// @ts-ignore
import {
    createMockLastFmApiService,
    createMockUserService,
    createMockWebSocketServer,
    setupTestEnvironment,
    type TestEnvironment,
} from "../helpers/testSetup";
import { Types } from "mongoose";

vi.mock("../../src/services/db/UserService", () => ({
    UserService: {
        create: vi.fn(),
    },
}));

vi.mock("../../src/utils/passwordUtils", () => ({
    PasswordUtils: {
        validatePassword: vi.fn(),
        hashPassword: vi.fn(),
        comparePassword: vi.fn(),
    },
}));

describe("RestUser", () => {
    let testEnv: TestEnvironment;

    const requestingUserUUID = "test-user-uuid";
    const adminUser = { uuid: requestingUserUUID, config: { isAdmin: true } };
    const nonAdminUser = { uuid: requestingUserUUID, config: { isAdmin: false } };
    const mockedUserService = createMockUserService();
    const mockedLastFmApiService = createMockLastFmApiService();

    beforeEach(() => {
        vi.clearAllMocks();

        const restUser = new RestUser(
            mockedUserService,
            mockedLastFmApiService as any,
            () => createMockWebSocketServer() as any
        );
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
                uuid: "test-user-uuid",
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app).get("/user/me").expect(200);

            expect(response.body.data).toEqual(mockUser);
            expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith("test-user-uuid");
        });
    });

    describe("PUT /me/location", () => {
        const validLocationData = {
            name: "Berlin",
            lat: 52.52,
            lon: 13.405,
        };

        it("should update user location successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                location: validLocationData,
            };

            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app).put("/user/me/location").send(validLocationData).expect(200);

            // TODO: mock timezone
            expect(response.body.data).toEqual(mockUser);
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith("test-user-uuid", {
                location: validLocationData, timezone: "Europe/Berlin",
            });
        });

        it("should return bad request for missing name", async () => {
            const invalidData = { lat: 52.52, lon: 13.405 };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("name");
        });

        it("should return bad request for empty name", async () => {
            const invalidData = { name: "", lat: 52.52, lon: 13.405 };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("name");
        });

        it("should return bad request for missing lat", async () => {
            const invalidData = { name: "Berlin", lon: 13.405 };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("lat");
        });

        it("should return bad request for missing lon", async () => {
            const invalidData = { name: "Berlin", lat: 52.52 };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("lon");
        });

        it("should return bad request for non-number lat", async () => {
            const invalidData = { name: "Berlin", lat: "not-a-number", lon: 13.405 };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("lat");
        });

        it("should return bad request for non-number lon", async () => {
            const invalidData = { name: "Berlin", lat: 52.52, lon: "not-a-number" };

            const response = await request(testEnv.app).put("/user/me/location").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("lon");
        });

        it("should accept negative coordinates", async () => {
            const locationWithNegativeCoords = {
                name: "Buenos Aires",
                lat: -34.6037,
                lon: -58.3816,
            };

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                location: locationWithNegativeCoords,
            };

            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .put("/user/me/location")
                .send(locationWithNegativeCoords)
                .expect(200);

            expect(response.body.data).toEqual(mockUser);
            //TODO: mock timezone
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith("test-user-uuid", {
                location: locationWithNegativeCoords,
                timezone: "America/Argentina/Buenos_Aires",
            });
        });

        it("should accept zero coordinates", async () => {
            const locationWithZeroCoords = {
                name: "Null Island",
                lat: 0,
                lon: 0,
            };

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                location: locationWithZeroCoords,
            };

            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app)
                .put("/user/me/location")
                .send(locationWithZeroCoords)
                .expect(200);

            expect(response.body.data).toEqual(mockUser);
        });
    });

    describe("PUT /me/lastFmUsername", () => {
        const validData = { username: "validUsername" };

        it("should update user lastFmUsername successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                lastFmUsername: "validUsername",
            };

            mockedLastFmApiService.validateUsername.mockResolvedValue(true);
            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app).put("/user/me/lastFmUsername").send(validData).expect(200);

            expect(response.body.data).toEqual(mockUser);
            expect(mockedLastFmApiService.validateUsername).toHaveBeenCalledWith(validData.username);
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith("test-user-uuid", {
                lastFmUsername: validData.username,
            });
        });

        it("should return bad request if Last.fm username is invalid/not found", async () => {
            const invalidUserData = { username: "this-user-does-not-exist" };

            mockedLastFmApiService.validateUsername.mockResolvedValue(false);

            const response = await request(testEnv.app)
                .put("/user/me/lastFmUsername")
                .send(invalidUserData)
                .expect(400);

            expect(response.body.data.message).toBe("Invalid Last.fm username");

            expect(mockedUserService.updateUserByUUID).not.toHaveBeenCalled();
        });

        it("should return bad request for missing username", async () => {
            const response = await request(testEnv.app).put("/user/me/lastFmUsername").send({}).expect(400);

            expect(response.body.data.details[0]).toContain("username");
            expect(mockedLastFmApiService.validateUsername).not.toHaveBeenCalled();
        });

        it("should return bad request for empty username", async () => {
            const response = await request(testEnv.app)
                .put("/user/me/lastFmUsername")
                .send({ username: "" })
                .expect(400);

            expect(response.body.data.details[0]).toContain("username");
            expect(mockedLastFmApiService.validateUsername).not.toHaveBeenCalled();
        });
    });

    describe("DELETE /me/lastFmUsername", () => {
        it("should clear lastFmUsername successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                lastFmUsername: "WOOHOOO",
            };

            const updatedUser = {
                ...mockUser,
                lastFmUsername: null,
            };

            mockedUserService.clearLastFmUsernameByUUID.mockResolvedValue(updatedUser);

            const response = await request(testEnv.app).delete("/user/me/lastFmUsername").expect(200);

            expect(response.body.data.user).toEqual(updatedUser);
            expect(mockedUserService.clearLastFmUsernameByUUID).toHaveBeenCalledWith("test-user-uuid");
        });
    });

    describe("PUT /me/state", () => {
        const validStateData = {
            lastState: {
                global: {
                    mode: "idle",
                    brightness: 50,
                },
                text: {
                    text: "Hello",
                    align: "center",
                    speed: 3,
                    size: 12,
                    color: [255, 255, 255],
                },
                image: {
                    image: "",
                },
                clock: {
                    color: [255, 255, 255],
                },
                music: {
                    fullscreen: false,
                },
            },
        };

        it("should update state successfully", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                lastState: validStateData.lastState,
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);
            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app).put("/user/me/state").send(validStateData).expect(200);

            expect(response.body.data.message).toBe("State updated successfully.");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith("test-user-uuid", {
                lastState: validStateData.lastState,
            });
        });

        it("should return bad request for missing lastState", async () => {
            const response = await request(testEnv.app).put("/user/me/state").send({}).expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should return bad request for empty lastState object", async () => {
            const response = await request(testEnv.app).put("/user/me/state").send({ lastState: {} }).expect(400);

            expect(response.body.data.details[0]).toContain("lastState");
        });

        it("should return bad request for null lastState", async () => {
            const response = await request(testEnv.app).put("/user/me/state").send({ lastState: null }).expect(400);

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
                        brightness: 75,
                    },
                },
            };

            mockedUserService.getUserByUUID.mockResolvedValue({
                uuid: "test-user-uuid",
                lastState: partialState.lastState,
            });
            mockedUserService.updateUserByUUID.mockResolvedValue({});

            const response = await request(testEnv.app).put("/user/me/state").send(partialState).expect(200);

            expect(response.body.data.message).toBe("State updated successfully.");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith("test-user-uuid", {
                lastState: partialState.lastState,
            });
        });
    });

    describe("PUT /me/password", () => {
        const validPasswordData = {
            password: "newpassword123",
            passwordConfirmation: "newpassword123",
        };

        it("should update password successfully", async () => {
            const { PasswordUtils } = await import("../../src/utils/passwordUtils");

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
                password: "old-hashed-password",
            };

            vi.mocked(PasswordUtils.validatePassword).mockReturnValue({ valid: true });
            vi.mocked(PasswordUtils.hashPassword).mockResolvedValue("new-hashed-password");
            mockedUserService.updateUserByUUID.mockResolvedValue(mockUser);

            const response = await request(testEnv.app).put("/user/me/password").send(validPasswordData).expect(200);

            expect(response.body.data.message).toBe("Password changed successfully");
            expect(PasswordUtils.validatePassword).toHaveBeenCalledWith("newpassword123");
            expect(PasswordUtils.hashPassword).toHaveBeenCalledWith("newpassword123");
            expect(mockedUserService.updateUserByUUID).toHaveBeenCalledWith(mockUser.uuid, {
                password: "new-hashed-password",
            });
        });

        it("should return bad request when passwords don't match", async () => {
            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            const invalidData = {
                password: "newpassword123",
                passwordConfirmation: "differentpassword",
            };

            const response = await request(testEnv.app).put("/user/me/password").send(invalidData).expect(400);

            expect(response.body.data.message).toBe("Passwörter stimmen nicht überein");
        });

        it("should return bad request for invalid password", async () => {
            const { PasswordUtils } = await import("../../src/utils/passwordUtils");

            const mockUser = {
                id: "test-user-id",
                name: "testuser",
                uuid: "test-user-uuid",
            };

            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);
            vi.mocked(PasswordUtils.validatePassword).mockReturnValue({
                valid: false,
                message: "Password too weak",
            });

            const response = await request(testEnv.app).put("/user/me/password").send(validPasswordData).expect(400);

            expect(response.body.data.message).toBe("Password too weak");
        });

        it("should return bad request for missing password", async () => {
            const invalidData = { passwordConfirmation: "newpassword123" };

            const response = await request(testEnv.app).put("/user/me/password").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("password");
        });

        it("should return bad request for missing passwordConfirmation", async () => {
            const invalidData = { password: "newpassword123" };

            const response = await request(testEnv.app).put("/user/me/password").send(invalidData).expect(400);

            expect(response.body.data.details[0]).toContain("passwordConfirmation");
        });

        it("should return bad request for short password", async () => {
            const invalidData = {
                password: "short",
                passwordConfirmation: "short",
            };

            const response = await request(testEnv.app).put("/user/me/password").send(invalidData).expect(400);

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
                    { id: "1", name: "user1", uuid: "uuid1" },
                    { id: "2", name: "user2", uuid: "uuid2" },
                ];
                mockedUserService.getAllUsers.mockResolvedValue(mockUsers);

                const response = await request(testEnv.app).get("/user/").expect(200);

                expect(response.body.data.users).toEqual(mockUsers);
                expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(requestingUserUUID);
                expect(mockedUserService.getAllUsers).toHaveBeenCalled();
            });

            it("should handle empty user list", async () => {
                mockedUserService.getAllUsers.mockResolvedValue([]);

                const response = await request(testEnv.app).get("/user/").expect(200);

                expect(response.body.data.users).toEqual([]);
            });
        });

        describe("when user is not an admin", () => {
            it("should return 404 Not Found if user is not an admin", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(nonAdminUser);

                await request(testEnv.app).get("/user/").expect(404);
            });

            it("should return 404 Not Found if user does not exist", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(null);

                await request(testEnv.app).get("/user/").expect(404);
            });
        });
    });

    describe("GET /:id (Admin only)", () => {
        const specificUserId = new Types.ObjectId().toString();
        const mockUser = {
            id: specificUserId,
            name: "specificuser",
            uuid: "specific-uuid",
        };

        describe("when user is an admin", () => {
            beforeEach(() => {
                mockedUserService.getUserByUUID.mockResolvedValue(adminUser);
            });

            it("should return user by id", async () => {
                mockedUserService.getUserById.mockResolvedValue(mockUser);

                const response = await request(testEnv.app).get(`/user/${specificUserId}`).expect(200);

                expect(response.body.data).toEqual(mockUser);
                expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(requestingUserUUID);
                expect(mockedUserService.getUserById).toHaveBeenCalledWith(specificUserId);
            });

            it("should return bad request when target user is not found", async () => {
                mockedUserService.getUserById.mockResolvedValue(null);

                const nonExistentUserId = new Types.ObjectId().toString();
                const response = await request(testEnv.app).get(`/user/${nonExistentUserId}`).expect(404);

                expect(response.body.data.message).toBe(
                    `Unable to find matching document with id: ${nonExistentUserId}`
                );
            });
        });

        describe("when user is not an admin", () => {
            it("should return 404 Not Found if user is not an admin", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(nonAdminUser);

                await request(testEnv.app).get(`/user/${specificUserId}`).expect(404);
            });

            it("should return 404 Not Found if user does not exist", async () => {
                mockedUserService.getUserByUUID.mockResolvedValue(null);

                await request(testEnv.app).get(`/user/${specificUserId}`).expect(404);
            });
        });
    });
});

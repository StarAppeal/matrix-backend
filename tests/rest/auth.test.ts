import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import request from "supertest";
import express from "express";
import {RestAuth} from "../../src/rest/auth";
import {JwtAuthenticator} from "../../src/utils/jwtAuthenticator";
import {PasswordUtils} from "../../src/utils/passwordUtils";
import {createMockJwtAuthenticator, createMockUserService, createPublicTestApp} from "../helpers/testSetup";
import crypto from "crypto";

vi.mock("../../src/db/services/db/UserService", () => ({
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

vi.mock("../../src/utils/jwtAuthenticator");
vi.mock("crypto", () => ({
    default: {
        randomUUID: vi.fn(),
    },
}));

describe("RestAuth", () => {
    let app: express.Application;
    let mockUserService: any;
    let mockPasswordUtils: any;
    let mockJwtAuthenticator: any;
    let mockCrypto: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockUserService = createMockUserService();

        mockPasswordUtils = vi.mocked(PasswordUtils);
        mockCrypto = vi.mocked(crypto);

        mockJwtAuthenticator = createMockJwtAuthenticator();
        vi.mocked(JwtAuthenticator).mockImplementation(() => mockJwtAuthenticator);

        const restAuth = new RestAuth(mockUserService);
        app = createPublicTestApp(restAuth.createRouter(), "/auth");

        process.env.SECRET_KEY = "test-secret-key";
    });

    afterEach(() => {
        vi.resetAllMocks();
        delete process.env.SECRET_KEY;
    });

    describe("POST /register", () => {
        const validRegistrationData = {
            username: "testuser",
            password: "TestPassword123!",
            timezone: "Europe/Berlin",
            location: "Berlin, Germany",
        };

        it("should register a new user successfully", async () => {
            const mockUUID = "test-uuid-123";
            const hashedPassword = "hashed-password-123";
            const createdUser = {
                name: "testuser",
                uuid: mockUUID,
                timezone: "Europe/Berlin",
                location: "Berlin, Germany",
                config: {isVisible: false, isAdmin: false, canBeModified: false},
            };

            mockUserService.existsUserByName.mockResolvedValue(false);
            mockPasswordUtils.validatePassword.mockReturnValue({valid: true});
            mockPasswordUtils.hashPassword.mockResolvedValue(hashedPassword);
            mockCrypto.randomUUID.mockReturnValue(mockUUID);
            mockUserService.createUser.mockResolvedValue(createdUser);

            const response = await request(app).post("/auth/register").send(validRegistrationData).expect(201);

            expect(response.body.ok).toBe(true);
            expect(response.body.data.user).toEqual(createdUser);
            expect(mockUserService.createUser).toHaveBeenCalledWith({
                name: "testuser",
                password: hashedPassword,
                uuid: mockUUID,
                config: {isVisible: false, isAdmin: false, canBeModified: false},
                timezone: "Europe/Berlin",
                location: "Berlin, Germany",
            });
        });

        it("should return conflict when username already exists", async () => {
            mockUserService.existsUserByName.mockResolvedValue(true);
            const response = await request(app).post("/auth/register").send(validRegistrationData).expect(409);
            expect(response.body.ok).toBe(false);
            expect(response.body.data.message).toBe("Username already exists");
            expect(response.body.data.details.field).toBe("username");
            expect(response.body.data.details.code).toBe("USERNAME_TAKEN");
        });

        it("should return bad request for invalid password", async () => {
            mockUserService.existsUserByName.mockResolvedValue(false);
            mockPasswordUtils.validatePassword.mockReturnValue({
                valid: false,
                message: "Password is not valid.",
            });
            const response = await request(app).post("/auth/register").send(validRegistrationData).expect(400);
            expect(response.body.ok).toBe(false);
            expect(response.body.data.message).toBe("Password is not valid.");
            expect(mockPasswordUtils.hashPassword).not.toHaveBeenCalled();
            expect(response.body.data.details.field).toBe("password");
            expect(response.body.data.details.code).toBe("INVALID_PASSWORD_FORMAT");

        });

        it.each([
            {field: "username"},
            {field: "password"},
            {field: "timezone"},
            {field: "location"},
        ])("should return bad request when $field is missing", async ({field}) => {
            const invalidData = {...validRegistrationData};
            delete (invalidData as any)[field];

            const response = await request(app).post("/auth/register").send(invalidData).expect(400);
            expect(response.body.ok).toBe(false);
            expect(response.body.data.details[0]).toContain(field);
        });

        it.each([
            {field: "username", value: "", message: "username"},
            {field: "username", value: "ab", message: "username"},
            {field: "password", value: "", message: "password"},
            {field: "password", value: "short", message: "password"},
            {field: "timezone", value: "", message: "timezone"},
            {field: "location", value: "", message: "location"},
        ])("should return bad request for invalid value in $field", async ({field, value, message}) => {
            const response = await request(app)
                .post("/auth/register")
                .send({...validRegistrationData, [field]: value})
                .expect(400);
            expect(response.body.ok).toBe(false);
            expect(response.body.data.details[0]).toContain(message);
        });
    });

    describe("POST /login", () => {
        const validLoginData = {username: "testuser", password: "TestPassword123!"};

        it("should login successfully with valid credentials", async () => {
            const mockUser = {name: "testuser", password: "hashed", uuid: "uuid-123", id: "user-id-123"};
            const mockToken = "jwt-token-123";

            mockUserService.getUserAuthByName.mockResolvedValue(mockUser);
            mockPasswordUtils.comparePassword.mockResolvedValue(true);
            mockJwtAuthenticator.generateToken.mockReturnValue(mockToken);

            const response = await request(app).post("/auth/login").send(validLoginData).expect(200);

            expect(response.body.ok).toBe(true);
            expect(response.body.data.token).toBe(mockToken);
            expect(mockJwtAuthenticator.generateToken).toHaveBeenCalledWith({
                username: "testuser",
                id: "user-id-123",
                uuid: "uuid-123",
            });

            const cookieHeader = response.headers['set-cookie'];
            expect(cookieHeader).toBeDefined();

            const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader!];

            const authTokenCookie = cookies.find((cookie: string) => cookie.startsWith("auth-token="));
            expect(authTokenCookie).toBeDefined();
            expect(authTokenCookie).toContain(`auth-token=${mockToken}`);
            expect(authTokenCookie).toContain("HttpOnly");
            expect(authTokenCookie).toContain("Path=/");
            expect(authTokenCookie).toContain("SameSite=Lax");
        });

        describe("POST /logout", () => {
            it("should clear the auth-token cookie and return a success message", async () => {
                const response = await request(app).post("/auth/logout").send().expect(200);

                expect(response.body.ok).toBe(true);
                expect(response.body.data.message).toBe("Successfully logged out");

                const cookieHeader = response.headers['set-cookie'];
                expect(cookieHeader).toBeDefined();
                const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader!];

                const authTokenCookie = cookies.find((cookie: string) => cookie.startsWith("auth-token="));
                expect(authTokenCookie).toBeDefined();
                expect(authTokenCookie).toContain("auth-token=;");
                expect(authTokenCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
            });

            it("should handle user with _id instead of id", async () => {
                const mockUser = {name: "testuser", password: "hashed", uuid: "uuid-123", _id: "user-id-123"};
                const mockToken = "jwt-token-123";

                mockUserService.getUserAuthByName.mockResolvedValue(mockUser);
                mockPasswordUtils.comparePassword.mockResolvedValue(true);
                mockJwtAuthenticator.generateToken.mockReturnValue(mockToken);

                await request(app).post("/auth/login").send(validLoginData).expect(200);

                expect(mockJwtAuthenticator.generateToken).toHaveBeenCalledWith({
                    username: "testuser",
                    id: "user-id-123",
                    uuid: "uuid-123",
                });
            });

            it("should return not found when user does not exist", async () => {
                mockUserService.getUserAuthByName.mockResolvedValue(null);
                const response = await request(app).post("/auth/login").send(validLoginData).expect(404);
                expect(response.body.ok).toBe(false);
                expect(response.body.data.message).toBe("User not found");
                expect(response.body.data.details.field).toBe("username")
                expect(response.body.data.details.code).toBe("INVALID_USER")

            });

            it("should return unauthorized for invalid password", async () => {
                const mockUser = {name: "testuser", password: "hashed"};
                mockUserService.getUserAuthByName.mockResolvedValue(mockUser);
                mockPasswordUtils.comparePassword.mockResolvedValue(false);
                const response = await request(app).post("/auth/login").send(validLoginData).expect(401);
                expect(response.body.ok).toBe(false);
                expect(response.body.data.message).toBe("Invalid password");
                expect(response.body.data.details.field).toBe("password")
                expect(response.body.data.details.code).toBe("INVALID_PASSWORD")
            });

            it.each([
                {field: "username", value: ""},
                {field: "password", value: ""},
                {field: "username", value: undefined},
                {field: "password", value: undefined},
            ])("should return bad request if $field is '$value'", async ({field, value}) => {
                const invalidData = {...validLoginData};
                if (value === undefined) {
                    delete (invalidData as any)[field];
                } else {
                    (invalidData as any)[field] = value;
                }

                const response = await request(app).post("/auth/login").send(invalidData).expect(400);

                expect(response.body.ok).toBe(false);
                expect(response.body.data.details[0]).toContain(field);
            });
        });
    });
});
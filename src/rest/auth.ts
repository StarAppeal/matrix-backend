import express from "express";
import { CreateUserPayload } from "../db/models/user";
import { JwtAuthenticator } from "../utils/jwtAuthenticator";
import crypto from "crypto";
import { PasswordUtils } from "../utils/passwordUtils";
import { asyncHandler } from "./middleware/asyncHandler";
import { validateBody, v } from "./middleware/validate";
import { ok, badRequest, unauthorized, created, conflict, notFound } from "./utils/responses";
import { UserService } from "../services/db/UserService";

export class RestAuth {
    private readonly userService: UserService;
    private readonly jwtAuthenticator: JwtAuthenticator;

    constructor(userService: UserService, jwtAuthenticator: JwtAuthenticator) {
        this.userService = userService;
        this.jwtAuthenticator = jwtAuthenticator;
    }

    public createRouter() {
        const router = express.Router();

        router.post(
            "/register",
            validateBody({
                username: { required: true, validator: v.isString({ nonEmpty: true, min: 3 }) },
                password: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
                timezone: { required: true, validator: v.isString({ nonEmpty: true }) },
                location: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { username, password, timezone, location } = req.body as {
                    username: string;
                    password: string;
                    timezone: string;
                    location: string;
                };

                if (await this.userService.existsUserByName(username)) {
                    return conflict(res, "Username already exists", { field: "username", code: "USERNAME_TAKEN" });
                }

                const passwordValidation = PasswordUtils.validatePassword(password);
                if (!passwordValidation.valid) {
                    return badRequest(res, passwordValidation.message ?? "Invalid password", {
                        field: "password",
                        code: "INVALID_PASSWORD_FORMAT",
                    });
                }

                const hashedPassword = await PasswordUtils.hashPassword(password);
                const newUser: CreateUserPayload = {
                    name: username,
                    password: hashedPassword,
                    uuid: crypto.randomUUID(),
                    config: {
                        isVisible: false,
                        isAdmin: false,
                        canBeModified: false,
                    },
                    timezone,
                    location,
                };

                const result = await this.userService.createUser(newUser);
                return created(res, { user: result });
            })
        );

        router.post(
            "/login",
            validateBody({
                username: { required: true, validator: v.isString({ nonEmpty: true }) },
                password: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { username, password } = req.body as { username: string; password: string };
                const user = await this.userService.getUserAuthByName(username);

                if (!user) {
                    return notFound(res, "User not found", { field: "username", code: "INVALID_USER" });
                }

                const isValid = await PasswordUtils.comparePassword(password, user.password!);
                if (!isValid) {
                    return unauthorized(res, "Invalid password", { field: "password", code: "INVALID_PASSWORD" });
                }

                const jwtToken = this.jwtAuthenticator.generateToken({
                    username: user.name,
                    id: user.id,
                    uuid: user.uuid,
                });

                res.cookie("auth-token", jwtToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    maxAge: 24 * 60 * 60 * 1000,
                });

                return ok(res, { token: jwtToken });
            })
        );

        router.post(
            "/logout",
            asyncHandler(async (req, res) => {
                res.clearCookie("auth-token");
                return ok(res, { message: "Successfully logged out" });
            })
        );

        return router;
    }
}

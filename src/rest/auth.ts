import express from "express";
import {UserService} from "../db/services/db/UserService";
import {IUser} from "../db/models/user";
import {JwtAuthenticator} from "../utils/jwtAuthenticator";
import crypto from "crypto";
import {PasswordUtils} from "../utils/passwordUtils";
import { asyncHandler } from "./middleware/asyncHandler";
import { validateBody, v } from "./middleware/validate";
import {ok, badRequest, unauthorized, created, conflict, notFound} from "./utils/responses";

export class RestAuth {
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
                    username: string; password: string; timezone: string; location: string;
                };
                const userService = await UserService.create();

                if (await userService.existsUserByName(username)) {
                    return conflict(res, "Username already exists");
                }

                const passwordValidation = PasswordUtils.validatePassword(password);
                if (!passwordValidation.valid) {
                    return badRequest(res, passwordValidation.message ?? "Invalid password");
                }

                const hashedPassword = await PasswordUtils.hashPassword(password);
                const newUser: IUser = {
                    name: username,
                    password: hashedPassword,
                    uuid: crypto.randomUUID(),
                    config: {
                        isVisible: false,
                        isAdmin: false,
                        canBeModified: false
                    },
                    timezone,
                    location
                };

                const result = await userService.createUser(newUser);
                return created(res, {user: result });
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
                const userService = await UserService.create();
                const user = await userService.getUserAuthByName(username);

                if (!user) {
                    return notFound(res, "User not found");
                }

                const isValid = await PasswordUtils.comparePassword(password, user.password!);
                if (!isValid) {
                    return unauthorized(res, "Invalid password");
                }

                const jwtToken = new JwtAuthenticator(process.env.SECRET_KEY!)
                    .generateToken({
                        username: user.name,
                        id: (user as any).id?.toString?.() ?? (user as any)._id?.toString?.(),
                        uuid: user.uuid
                    });

                return ok(res, { token: jwtToken });
            })
        );

        return router;
    }
}
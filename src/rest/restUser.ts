import express from "express";
import {UserService} from "../db/services/db/UserService";
import {PasswordUtils} from "../utils/passwordUtils";
import {asyncHandler} from "./middleware/asyncHandler";
import {v, validateBody, validateParams} from "./middleware/validate";
import {badRequest, ok} from "./utils/responses";
import {isAdmin} from "./middleware/isAdmin";

export class RestUser {
    public createRouter() {
        const router = express.Router();

        router.get("/",isAdmin,  asyncHandler(async (_req, res) => {
            const userService = await UserService.create();
            const users = await userService.getAllUsers();
            return ok(res, { users });
        }));

        router.get("/me", asyncHandler(async (req, res) => {
            const userService = await UserService.create();
            const user = await userService.getUserByUUID(req.payload.uuid);
            return ok(res, user);
        }));

        router.put(
            "/me/spotify",
            validateBody({
                accessToken: { required: true, validator: v.isString({ nonEmpty: true }) },
                refreshToken: { required: true, validator: v.isString({ nonEmpty: true }) },
                scope: { required: true, validator: v.isString({ nonEmpty: true }) },
                expirationDate: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const userService = await UserService.create();
                const user = await userService.getUserByUUID(req.payload.uuid);
                if (!user) {
                    return badRequest(res, "User not found");
                }

                const { accessToken, refreshToken, scope, expirationDate } = req.body as {
                    accessToken: string; refreshToken: string; scope: string; expirationDate: string;
                };

                user.spotifyConfig = {
                    accessToken,
                    refreshToken,
                    scope,
                    expirationDate: new Date(expirationDate),
                };

                await userService.updateUser(user);
                return ok(res, { message: "Spotify Config erfolgreich geändert" });
            })
        );

        router.delete("/me/spotify", asyncHandler(async (req, res) => {
            const userService = await UserService.create();
            const user = await userService.getUserByUUID(req.payload.uuid);
            if (!user) {
                return badRequest(res, "User not found");
            }

            const updated = await userService.clearSpotifyConfigByUUID(req.payload.uuid);
            return ok(res, { user: updated });
        }));

        router.put(
            "/me/password",
            validateBody({
                password: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
                passwordConfirmation: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
            }),
            asyncHandler(async (req, res) => {
                const userService = await UserService.create();
                const user = await userService.getUserByUUID(req.payload.uuid);
                if (!user) {
                    return badRequest(res, "User not found");
                }

                const { password, passwordConfirmation } = req.body as { password: string; passwordConfirmation: string };

                if (password !== passwordConfirmation) {
                    return badRequest(res, "Passwörter stimmen nicht überein");
                }

                const passwordValidation = PasswordUtils.validatePassword(password);
                if (!passwordValidation.valid) {
                    return badRequest(res, passwordValidation.message ?? "Invalid password");
                }

                user.password = await PasswordUtils.hashPassword(password);

                await userService.updateUser(user);
                return ok(res, { message: "Passwort erfolgreich geändert" });
            })
        );

        router.get(
            "/:id",
            validateParams({
                id: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            isAdmin,
            asyncHandler(async (req, res) => {
                const userService = await UserService.create();
                const id = req.params.id;
                const user = await userService.getUserById(id);

                if (!user) {
                    return badRequest(res, `Unable to find matching document with id: ${id}`);
                }
                return ok(res, user);
            })
        );

        return router;
    }
}
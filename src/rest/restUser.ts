import express from "express";
import { PasswordUtils } from "../utils/passwordUtils";
import { asyncHandler } from "./middleware/asyncHandler";
import { v, validateBody, validateParams } from "./middleware/validate";
import { badRequest, ok } from "./utils/responses";
import { isAdmin } from "./middleware/isAdmin";
import { UserService } from "../services/db/UserService";

export class RestUser {
    private readonly userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    public createRouter() {
        const router = express.Router();

        router.get(
            "/",
            isAdmin(this.userService),
            asyncHandler(async (_req, res) => {
                const users = await this.userService.getAllUsers();
                return ok(res, { users });
            })
        );

        router.get(
            "/me",
            asyncHandler(async (req, res) => {
                const user = await this.userService.getUserByUUID(req.payload.uuid);
                return ok(res, user);
            })
        );

        router.put(
            "/me/spotify",
            validateBody({
                accessToken: { required: true, validator: v.isString({ nonEmpty: true }) },
                refreshToken: { required: true, validator: v.isString({ nonEmpty: true }) },
                scope: { required: true, validator: v.isString({ nonEmpty: true }) },
                expirationDate: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { accessToken, refreshToken, scope, expirationDate } = req.body as {
                    accessToken: string;
                    refreshToken: string;
                    scope: string;
                    expirationDate: string;
                };

                const spotifyConfig = {
                    accessToken,
                    refreshToken,
                    scope,
                    expirationDate: new Date(expirationDate),
                };

                await this.userService.updateUserByUUID(req.payload.uuid, { spotifyConfig: spotifyConfig });
                return ok(res, { message: "Spotify config changed successfully." });
            })
        );

        router.delete(
            "/me/spotify",
            asyncHandler(async (req, res) => {
                const updated = await this.userService.clearSpotifyConfigByUUID(req.payload.uuid);
                return ok(res, { user: updated });
            })
        );

        router.put(
            "/me/password",
            validateBody({
                password: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
                passwordConfirmation: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
            }),
            asyncHandler(async (req, res) => {
                const { password, passwordConfirmation } = req.body as {
                    password: string;
                    passwordConfirmation: string;
                };

                if (password !== passwordConfirmation) {
                    return badRequest(res, "Passwörter stimmen nicht überein");
                }

                const passwordValidation = PasswordUtils.validatePassword(password);
                if (!passwordValidation.valid) {
                    return badRequest(res, passwordValidation.message ?? "Invalid password");
                }

                const newPassword = await PasswordUtils.hashPassword(password);

                await this.userService.updateUserByUUID(req.payload.uuid, { password: newPassword });
                return ok(res, { message: "Password changed successfully" });
            })
        );

        router.get(
            "/:id",
            validateParams({
                id: { required: true, validator: v.isObjectId() },
            }),
            isAdmin(this.userService),
            asyncHandler(async (req, res) => {
                const id = req.params.id;
                const user = await this.userService.getUserById(id);

                if (!user) {
                    return badRequest(res, `Unable to find matching document with id: ${id}`);
                }
                return ok(res, user);
            })
        );

        return router;
    }
}

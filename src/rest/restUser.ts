import express from "express";
import { PasswordUtils } from "../utils/passwordUtils";
import { asyncHandler } from "./middleware/asyncHandler";
import { v, validateBody, validateParams } from "./middleware/validate";
import { badRequest, notFound, ok } from "./utils/responses";
import { isAdmin } from "./middleware/isAdmin";
import { UserService } from "../services/db/UserService";
import { ExtendedWebSocketServer } from "../websocket";
import { MatrixState } from "../db/models/user";
import logger from "../utils/logger";
import { LastFmApiService } from "../services/lastFmApiService";
import { OwmApiService } from "../services/owmApiService";
import { WebsocketOutboundType } from "../utils/websocket/websocketCustomEvents/websocketOutboundType";


export class RestUser {
    private readonly userService: UserService;
    private readonly lastFmApiService: LastFmApiService;
    private readonly owmApiService: OwmApiService;
    private readonly webSocketServerProvider?: () => ExtendedWebSocketServer | null;

    constructor(
        userService: UserService,
        lastFmApiService: LastFmApiService,
        owmApiService: OwmApiService,
        webSocketServerProvider?: () => ExtendedWebSocketServer | null
    ) {
        this.userService = userService;
        this.lastFmApiService = lastFmApiService;
        this.owmApiService = owmApiService;
        this.webSocketServerProvider = webSocketServerProvider;
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
                if (!user) {
                    return notFound(res, "User not found");
                }
                return ok(res, user);
            })
        );

        router.put(
            "/me/location",
            validateBody({
                name: { required: true, validator: v.isString({ nonEmpty: true }) },
                lat: { required: true, validator: v.isNumber() },
                lon: { required: true, validator: v.isNumber() },
            }),
            asyncHandler(async (req, res) => {
                const { name, lat, lon } = req.body as { name: string; lat: number; lon: number };

                //TODO: probably not saving timezone in database anymore, refactor it to determine it when needed (I guess?)
                const timezone = this.owmApiService.getTimezoneName(lat, lon);
                logger.info(`Determined timezone for coordinates (${lat}, ${lon}): ${timezone}`);

                const user = await this.userService.updateUserByUUID(req.payload.uuid, {
                    location: { name, lat, lon },
                    timezone,
                });

                return ok(res, user);
            })
        );

        router.put(
            "/me/lastFmUsername",
            validateBody({
                username: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { username } = req.body as { username: string };

                const isValid = await this.lastFmApiService.validateUsername(username);
                if (!isValid) {
                    return badRequest(res, "Invalid Last.fm username");
                }

                const user = await this.userService.updateUserByUUID(req.payload.uuid, {
                    lastFmUsername: username,
                });

                return ok(res, user);
            })
        );

        router.delete(
            "/me/lastFmUsername",
            asyncHandler(async (req, res) => {
                const updated = await this.userService.clearLastFmUsernameByUUID(req.payload.uuid);
                return ok(res, { user: updated });
            })
        );

        router.put(
            "/me/state",
            validateBody({
                lastState: {
                    required: true,
                    validator: v.isObject({ nonEmpty: true }),
                },
            }),
            asyncHandler(async (req, res) => {
                const { lastState } = req.body as { lastState: MatrixState };
                const user = await this.userService.getUserByUUID(req.payload.uuid);
                if (!user) {
                    return notFound(res, "User not found");
                }

               const updated =  await this.userService.updateUserByUUID(req.payload.uuid, { lastState });

                if (this.webSocketServerProvider) {
                    const webSocketServer = this.webSocketServerProvider();

                    if (webSocketServer) {
                        logger.info("Sending payload to websocket");
                        const message = JSON.stringify({ type: WebsocketOutboundType.STATE, payload: updated?.lastState });
                        webSocketServer.sendMessageToUser(req.payload.uuid, message);
                    }
                }

                return ok(res, { message: "State updated successfully." });
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
            isAdmin(this.userService),
            validateParams({
                id: { required: true, validator: v.isObjectId() },
            }),
            asyncHandler(async (req, res) => {
                const id = req.params.id;
                const user = await this.userService.getUserById(id);

                if (!user) {
                    return notFound(res, `Unable to find matching document with id: ${id}`);
                }
                return ok(res, user);
            })
        );

        return router;
    }
}

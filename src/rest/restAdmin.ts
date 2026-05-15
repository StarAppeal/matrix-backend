import express from "express";
import crypto from "crypto";
import { asyncHandler } from "./middleware/asyncHandler";
import { v, validateBody, validateParams } from "./middleware/validate";
import { badRequest, created, notFound, ok } from "./utils/responses";
import { isAdmin } from "./middleware/isAdmin";
import { UserService } from "../services/db/UserService";
import { ExtendedWebSocketServer } from "../websocket";
import { JwtAuthenticator } from "../utils/jwtAuthenticator";
import { PasswordUtils } from "../utils/passwordUtils";
import { CreateUserPayload } from "../db/models/user";
import { TamagotchiService } from "../services/db/tamagotchiService";

const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;

function generateRandomPassword(length = 12): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&";
    return Array.from(crypto.randomBytes(length))
        .map((b) => chars[b % chars.length])
        .join("");
}

export class RestAdmin {
    constructor(
        private readonly userService: UserService,
        private readonly jwtAuthenticator: JwtAuthenticator,
        private readonly tamagotchiService: TamagotchiService,
        private readonly webSocketServerProvider?: () => ExtendedWebSocketServer | null
    ) {}

    public createRouter() {
        const router = express.Router();

        //TODO: evaluate if its better to have it in server.ts
        router.use(isAdmin(this.userService));

        router.get(
            "/stats",
            asyncHandler(async (_req, res) => {
                const [totalUsers, deletedUsers, admins] = await Promise.all([
                    this.userService.countUsers(),
                    this.userService.countDeletedUsers(),
                    this.userService.countAdmins(),
                ]);

                const wsServer = this.webSocketServerProvider?.();
                const activeConnections = wsServer ? wsServer.getConnectedClients().size : 0;

                return ok(res, {
                    totalUsers,
                    deletedUsers,
                    admins,
                    activeConnections,
                });
            })
        );

        router.get(
            "/users",
            asyncHandler(async (_req, res) => {
                const users = await this.userService.getAllUsersIncludingDeleted();
                return ok(res, { users });
            })
        );

        router.post(
            "/users",
            validateBody({
                username: { required: true, validator: v.isString({ nonEmpty: true, min: 3 }) },
                password: { required: true, validator: v.isString({ nonEmpty: true, min: 8 }) },
                timezone: { required: true, validator: v.isString({ nonEmpty: true }) },
                location: { required: true, validator: v.isObject({ nonEmpty: true }) },
                isAdmin: { required: false, validator: v.isBoolean() },
                isVisible: { required: false, validator: v.isBoolean() },
                canBeModified: { required: false, validator: v.isBoolean() },
            }),
            asyncHandler(async (req, res) => {
                const { username, password, timezone, location, isAdmin: admin, isVisible, canBeModified } = req.body as {
                    username: string;
                    password: string;
                    timezone: string;
                    location: { name: string; lat: number; lon: number };
                    isAdmin?: boolean;
                    isVisible?: boolean;
                    canBeModified?: boolean;
                };

                if (await this.userService.existsUserByName(username)) {
                    return badRequest(res, "Username already exists", { field: "username", code: "USERNAME_TAKEN" });
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
                        isAdmin: admin ?? false,
                        isVisible: isVisible ?? false,
                        canBeModified: canBeModified ?? false,
                    },
                    timezone,
                    location,
                };

                const result = await this.userService.createUser(newUser);
                return created(res, { user: result });
            })
        );

        router.get(
            "/users/:id",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            asyncHandler(async (req, res) => {
                const user = await this.userService.getUserById(req.params.id);
                if (!user) return notFound(res, "User not found");
                return ok(res, { user });
            })
        );

        router.put(
            "/users/:id",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            validateBody({
                name: { required: false, validator: v.isString({ nonEmpty: true, min: 3 }) },
                timezone: { required: false, validator: v.isString({ nonEmpty: true }) },
                location: { required: false, validator: v.isObject({ nonEmpty: true }) },
                lastFmUsername: { required: false, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { name, timezone, location, lastFmUsername } = req.body as {
                    name?: string;
                    timezone?: string;
                    location?: { name: string; lat: number; lon: number };
                    lastFmUsername?: string;
                };

                const updates: Record<string, unknown> = {};
                if (name !== undefined) updates.name = name;
                if (timezone !== undefined) updates.timezone = timezone;
                if (location !== undefined) updates.location = location;
                if (lastFmUsername !== undefined) updates.lastFmUsername = lastFmUsername;

                const user = await this.userService.updateUserById(req.params.id, updates as never);
                if (!user) return notFound(res, "User not found");
                return ok(res, { user });
            })
        );

        router.put(
            "/users/:id/config",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            validateBody({
                isAdmin: { required: false, validator: v.isBoolean() },
                isVisible: { required: false, validator: v.isBoolean() },
                canBeModified: { required: false, validator: v.isBoolean() },
            }),
            asyncHandler(async (req, res) => {
                const existing = await this.userService.getUserById(req.params.id);
                if (!existing) return notFound(res, "User not found");

                const { isAdmin: admin, isVisible, canBeModified } = req.body as {
                    isAdmin?: boolean;
                    isVisible?: boolean;
                    canBeModified?: boolean;
                };

                const config = {
                    isAdmin: admin ?? existing.config.isAdmin,
                    isVisible: isVisible ?? existing.config.isVisible,
                    canBeModified: canBeModified ?? existing.config.canBeModified,
                };

                const user = await this.userService.updateUserById(req.params.id, { config } as never);
                return ok(res, { user });
            })
        );

        router.post(
            "/users/:id/reset-password",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            asyncHandler(async (req, res) => {
                const existing = await this.userService.getUserById(req.params.id);
                if (!existing) return notFound(res, "User not found");

                const tempPassword = generateRandomPassword();
                const hashedPassword = await PasswordUtils.hashPassword(tempPassword);

                await this.userService.updateUserById(req.params.id, { password: hashedPassword } as never);

                return ok(res, { tempPassword });
            })
        );

        router.post(
            "/users/:id/token",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            asyncHandler(async (req, res) => {
                const user = await this.userService.getUserById(req.params.id);
                if (!user) return notFound(res, "User not found");

                const token = this.jwtAuthenticator.generateToken(
                    {
                        username: user.name,
                        id: (user._id as { toHexString: () => string }).toHexString(),
                        uuid: user.uuid,
                    },
                    MONTH_IN_MS
                );

                return ok(res, { token });
            })
        );

        router.delete(
            "/users/:id",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            asyncHandler(async (req, res) => {
                const existing = await this.userService.getUserById(req.params.id);
                if (!existing) return notFound(res, "User not found");

                const user = await this.userService.softDeleteUser(req.params.id);
                return ok(res, { user });
            })
        );

        router.post(
            "/users/:id/restore",
            validateParams({ id: { required: true, validator: v.isObjectId() } }),
            asyncHandler(async (req, res) => {
                const user = await this.userService.restoreUser(req.params.id);
                if (!user) return notFound(res, "User not found");
                return ok(res, { user });
            })
        );

        router.get(
            "/websocket/clients",
            asyncHandler(async (_req, res) => {
                const wsServer = this.webSocketServerProvider?.();
                if (!wsServer) return ok(res, { clients: [] });

                const clients = Array.from(wsServer.getConnectedClients()).map((c) => c.payload);
                return ok(res, { clients });
            })
        );

        router.get(
            "/tamagotchis",
            asyncHandler(async (_req, res) => {
                const tamagotchis = await this.tamagotchiService.getAllTamagotchis();
                return ok(res, { tamagotchis });
            })
        );

        router.post(
            "/tamagotchis/:uuid/revive",
            validateParams({ uuid: { required: true, validator: v.isString() } }),
            asyncHandler(async (req, res) => {
                const tamagotchi = await this.tamagotchiService.revive(req.params.uuid);
                return ok(res, { tamagotchi });
            })
        );

        router.put(
            "/tamagotchis/:uuid",
            validateParams({ uuid: { required: true, validator: v.isString() } }),
            validateBody({
                hunger: { required: false, validator: v.isNumber() },
                happiness: { required: false, validator: v.isNumber() },
                hygiene: { required: false, validator: v.isNumber() },
                energy: { required: false, validator: v.isNumber() },
            }),
            asyncHandler(async (req, res) => {
                const stats = req.body as { hunger?: number; happiness?: number; hygiene?: number; energy?: number };
                const tamagotchi = await this.tamagotchiService.updateStats(req.params.uuid, stats);
                return ok(res, { tamagotchi });
            })
        );

        return router;
    }
}

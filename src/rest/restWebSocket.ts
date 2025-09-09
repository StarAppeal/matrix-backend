import express, { Router, Request, Response } from "express";
import { ExtendedWebSocketServer } from "../websocket";
import { asyncHandler } from "./middleware/asyncHandler";
import {v, validateBody} from "./middleware/validate";
import { ok } from "./utils/responses";
import {ExtendedWebSocket} from "../interfaces/extendedWebsocket";

export class RestWebSocket {
    constructor(private webSocketServer: ExtendedWebSocketServer) {}

    public createRouter(): Router {
        const router = express.Router();

        router.post(
            "/broadcast",
            validateBody({
                payload: {
                    required: true,
                    validator: v.isObject({ nonEmpty: true }),
                },
            }),
            asyncHandler(async (req: Request, res: Response) => {
                const payload: string = JSON.stringify(req.body.payload);
                this.webSocketServer.broadcast(payload);
                return ok(res, { status: "OK" });
            })
        );

        router.post(
            "/send-message",
            validateBody({
                payload: {
                    required: true,
                    validator: v.isObject({ nonEmpty: true }),
                },
                users: {
                    required: true,
                    validator: (value: any) =>
                        Array.isArray(value) && value.length > 0 && value.every((s) => typeof s === "string" && s.trim().length > 0)
                            ? true
                            : "must be a non-empty array of strings",
                },
            }),
            asyncHandler(async (req: Request, res: Response) => {
                const payload = JSON.stringify(req.body.payload);
                const users: Array<string> = req.body.users;

                users.forEach((user) => this.webSocketServer.sendMessageToUser(user, payload));

                return ok(res, { status: "OK" });
            })
        );

        router.get("/all-clients", asyncHandler(async (_req: Request, res: Response) => {
            const connectedClients = this.webSocketServer.getConnectedClients();
            const result = Array.from(connectedClients).map((client: ExtendedWebSocket) => client.payload);
            return ok(res, { result });
        }));


        return router;
    }
}
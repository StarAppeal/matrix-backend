import express from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { ok } from "./utils/responses";

export class JwtTokenPropertiesExtractor {
    public createRouter() {
        const router = express.Router();

        router.get("/id", asyncHandler(async (req: Request, res: Response) => {
            return ok(res, req.payload.id);
        }));


        router.get("/username", asyncHandler(async (req: Request, res: Response) => {
            return ok(res, req.payload.username);
        }));

        router.get("/uuid", asyncHandler(async (req: Request, res: Response) => {
            return ok(res, req.payload.uuid);
        }));

        return router;
    }
}
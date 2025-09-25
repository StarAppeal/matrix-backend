import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { tooManyRequests } from "../utils/responses";

const onLimitReached = (_req: Request, res: Response) => {
    return tooManyRequests(res);
};

export const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: onLimitReached,
});

export const spotifyLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: onLimitReached,
});

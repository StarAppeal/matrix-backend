import type { NextFunction, Request, Response } from "express";
import { notFound } from "../utils/responses";
import { UserService } from "../../services/db/UserService";

export function isAdmin(userService: UserService) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const payload = req.payload;
            const user = await userService.getUserByUUID(payload.uuid);

            if (user?.config?.isAdmin) {
                return next();
            } else {
                return notFound(res);
            }
        } catch (error) {
            return next(error);
        }
    };
}

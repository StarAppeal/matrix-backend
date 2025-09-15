import type {NextFunction, Request, Response} from "express";
import {UserService} from "../../db/services/db/UserService";
import {notFound} from "../utils/responses";


export async function isAdmin(
    req: Request,
    res: Response,
    next: NextFunction) {
    try {
        const payload = req.payload;
        const userService = await UserService.create();
        const user = await userService.getUserByUUID(payload.uuid);

        if (user && user.config.isAdmin) {
            next();
        } else {
            return notFound(res);
        }
    } catch (error) {
        next(error);
    }
}
import type { Request, Response, NextFunction } from "express";

export const asyncHandler = (
    fn: (req: Request, res: Response, next?: NextFunction) => Promise<Response | void> | Response | void
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            Promise.resolve(fn(req, res, next)).catch(next);
        } catch (error) {
            next(error);
        }
    };
};

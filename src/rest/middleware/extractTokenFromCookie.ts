import { Request, Response, NextFunction } from 'express';

export const extractTokenFromCookie = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
        return next();
    }

    const token = req.cookies['auth-token'];

    if (token) {
        req.headers.authorization = `Bearer ${token}`;
    }

    next();
};
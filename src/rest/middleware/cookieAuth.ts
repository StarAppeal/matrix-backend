import { Request, Response, NextFunction } from 'express';

export const cookieJwtAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization) {
        return next();
    }

    const token = req.cookies['auth-token'];

    if (token) {
        req.headers.authorization = `Bearer ${token}`;
    }

    next();
};
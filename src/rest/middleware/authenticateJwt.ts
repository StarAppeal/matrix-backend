import { Request, Response, NextFunction } from "express";
import { unauthorized } from "../utils/responses";
import { JwtAuthenticator } from "../../utils/jwtAuthenticator";

const BEARER_PREFIX = "Bearer ";

export function authenticateJwt(jwtAuthenticator: JwtAuthenticator) {
    return (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return unauthorized(res, "Unauthorized: No Authorization header provided");
        }

        if (!authHeader.startsWith(BEARER_PREFIX)) {
            return unauthorized(res, "Unauthorized: Token must be a Bearer token");
        }

        const token = authHeader.slice(BEARER_PREFIX.length);

        if (!token) {
            return unauthorized(res, "Unauthorized: Token is missing");
        }

        try {
            const decodedToken = jwtAuthenticator.verifyToken(token);
            console.log(decodedToken);

            if (!decodedToken) {
                return unauthorized(res, "Unauthorized: Invalid token");
            }

            req.payload = decodedToken;
            next();
        } catch (error: any) {
            console.error("JWT Verification Error:", error.message);
            return unauthorized(res, "Unauthorized: Token verification failed");
        }
    };
}

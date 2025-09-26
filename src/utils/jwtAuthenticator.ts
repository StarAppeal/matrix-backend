import jwt from "jsonwebtoken";
import { DecodedToken } from "../interfaces/decodedToken";
import logger from "./logger";

export class JwtAuthenticator {
    constructor(private secret: string) {}

    public verifyToken(token: string | undefined): DecodedToken | null {
        if (!token) {
            return null;
        }

        try {
            return jwt.verify(token, this.secret) as DecodedToken;
        } catch (error) {
            logger.error("Error while verifying token:", error);
        }

        return null;
    }

    public generateToken(payload: DecodedToken): string {
        return jwt.sign(payload, this.secret);
    }
}

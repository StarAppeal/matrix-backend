import "dotenv/config";

import { IncomingMessage } from "node:http";
import { ExtendedIncomingMessage } from "../interfaces/extendedIncomingMessage";
import { JwtAuthenticator } from "./jwtAuthenticator";
import logger from "./logger";

export function verifyClient(
    request: IncomingMessage,
    jwtAuthenticator: JwtAuthenticator,
    callback: (res: boolean, code?: number, message?: string) => void
) {
    const token = jwtAuthenticator.verifyToken(request.headers["authorization"]?.slice("Bearer ".length));
    if (!token) {
        reject(request, callback);
    } else {
        (request as ExtendedIncomingMessage).payload = token;
        callback(true);
    }
}

const reject = (request: IncomingMessage, callback: (res: boolean, code?: number, message?: string) => void) => {
    logger.warn(`Connection refused from ${request.socket.remoteAddress}:${request.socket.remotePort}`);
    callback(false, 401, "Unauthorized");
};

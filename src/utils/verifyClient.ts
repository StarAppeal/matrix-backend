import { IncomingMessage } from "node:http";
import { ExtendedIncomingMessage } from "../interfaces/extendedIncomingMessage";
import { JwtAuthenticator } from "./jwtAuthenticator";
import logger from "./logger";

export function verifyClient(
    request: IncomingMessage,
    jwtAuthenticator: JwtAuthenticator,
    callback: (res: boolean, code?: number, message?: string) => void
) {
    let tokenStr: string | undefined;

    const authHeader = request.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
        tokenStr = authHeader.slice("Bearer ".length);
    }
    else if (request.url) {
        try {
            const url = new URL(request.url, "http://localhost");
            tokenStr = url.searchParams.get("token") || undefined;
        } catch (_) {
            logger.debug("Failed to parse WebSocket URL for token");
        }
    }

    if (!tokenStr) {
        return reject(request, callback);
    }

    const decodedPayload = jwtAuthenticator.verifyToken(tokenStr);

    if (!decodedPayload) {
        return reject(request, callback);
    }

    (request as ExtendedIncomingMessage).payload = decodedPayload;
    callback(true);
}

const reject = (request: IncomingMessage, callback: (res: boolean, code?: number, message?: string) => void) => {
    logger.warn(`Connection refused from ${request.socket.remoteAddress}:${request.socket.remotePort} (Unauthorized)`);
    callback(false, 401, "Unauthorized");
};

import { WebSocket, WebSocketServer } from "ws";
import { DecodedToken } from "../../interfaces/decodedToken";
import logger from "../../utils/logger";

export function heartbeat(wss: WebSocketServer) {
    return () => {
        wss.clients.forEach((ws: WebSocket & { isAlive?: boolean; payload?: DecodedToken }) => {
            logger.debug(
                `Heartbeat check: ${new Date().toLocaleString("de-DE")} - User: ${ws.payload?.username} - isAlive: ${ws.isAlive}`
            );
            if (!ws.isAlive) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        });
    };
}

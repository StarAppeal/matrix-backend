import { WebSocket, WebSocketServer } from "ws";
import { DecodedToken } from "../../interfaces/decodedToken";

export function heartbeat(wss: WebSocketServer) {
  return () => {
    wss.clients.forEach(
      (ws: WebSocket & { isAlive?: boolean; payload?: DecodedToken }) => {
        console.log(
          new Date().toLocaleString("de-DE") +
            ":" +
            ws.payload?.username +
            ": isAlive: " +
            ws.isAlive,
        );
        if (!ws.isAlive) return ws.terminate();

        ws.isAlive = false;
        ws.ping();
      },
    );
  };
}

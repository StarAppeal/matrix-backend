import { Server } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedIncomingMessage } from "./interfaces/extendedIncomingMessage";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { DecodedToken } from "./interfaces/decodedToken";

export class ExtendedWebSocketServer {
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      verifyClient: (info, callback) => verifyClient(info.req, callback),
    });

    this.setupWebSocket();

    const interval = setInterval(() => {
      this.wss.clients.forEach(
        (ws: WebSocket & { isAlive?: boolean; payload?: DecodedToken }) => {
          console.log(ws.payload?.name + ": isAlive: " + ws.isAlive);
          if (!ws.isAlive) return ws.terminate();
          ws.send("keepalive");

          ws.isAlive = false;
          ws.ping();
        },
      );
    }, 30000);

    this.wss.on("close", function close() {
      clearInterval(interval);
    });
  }

  private setupWebSocket() {
    this.wss.on(
      "connection",
      (ws: ExtendedWebSocket, request: ExtendedIncomingMessage) => {
        ws.payload = request.payload;
        ws.isAlive = true;

        console.log("WebSocket client connected");

        ws.on("error", console.error);

        ws.on("pong", () => {
          ws.isAlive = true;
        });

        ws.on("message", (data) => {
          const message = data.toString();
          console.log("Received message:", message);

          const json: { username: string; message: string } =
            JSON.parse(message);

          this.sendMessageToUser(json.username, json.message);
        });
      },
    );
  }

  public broadcast(message: string) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public sendMessageToUser(userName: string, message: string) {
    this.wss.clients.forEach(
      (client: WebSocket & { payload?: DecodedToken }) => {
        if (
          client.payload?.name === userName &&
          client.readyState === WebSocket.OPEN
        ) {
          client.send(message, { binary: false });
        }
      },
    );
  }
}

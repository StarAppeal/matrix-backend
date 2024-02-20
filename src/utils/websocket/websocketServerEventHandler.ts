import { ExtendedWebSocket } from "../../interfaces/extendedWebsocket";
import { ExtendedIncomingMessage } from "../../interfaces/extendedIncomingMessage";
import { Server as WebSocketServer } from "ws";
import { heartbeat } from "./websocketServerHeartbeatInterval";

export class WebsocketServerEventHandler {
  private readonly heartbeat: () => void;

  constructor(private webSocketServer: WebSocketServer) {
    this.heartbeat = heartbeat(this.webSocketServer);
  }

  public enableConnectionEvent(
    callback: (ws: ExtendedWebSocket, request: ExtendedIncomingMessage) => void,
  ) {
    this.webSocketServer.on(
      "connection",
      (ws: ExtendedWebSocket, request: ExtendedIncomingMessage) => {
        // first: map the payload from the request to the ws object
        ws.payload = request.payload;
        // second: set the isAlive flag to true
        ws.isAlive = true;

        // last: call the callback function
        callback(ws, request);
      },
    );
  }

  public enableHeartbeat(interval: number) {
    return setInterval(() => {
      this.heartbeat();
    }, interval);
  }

  public enableCloseEvent(callback: () => void) {
    this.webSocketServer.on("close", () => {
      console.log("WebSocket server closed");
      callback();
    });
  }
}

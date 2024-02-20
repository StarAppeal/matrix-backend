import { Server } from "http";
import { WebSocket, Server as WebSocketServer } from "ws";
import { verifyClient } from "./utils/verifyClient";
import { ExtendedWebSocket } from "./interfaces/extendedWebsocket";
import { DecodedToken } from "./interfaces/decodedToken";
import { WebsocketServerEventHandler } from "./utils/websocket/websocketServerEventHandler";
import { WebsocketEventHandler } from "./utils/websocket/websocketEventHandler";

export class ExtendedWebSocketServer {
  private readonly _wss: WebSocketServer;

  constructor(server: Server) {
    this._wss = new WebSocketServer({
      server,
      verifyClient: (info, callback) => verifyClient(info.req, callback),
    });

    this.setupWebSocket();
  }

  private setupWebSocket() {
    const serverEventHandler = new WebsocketServerEventHandler(this.wss);
    serverEventHandler.enableConnectionEvent((ws) => {
      let socketEventHandler = new WebsocketEventHandler(ws);

      console.log("WebSocket client connected");

      socketEventHandler.enableErrorEvent();
      socketEventHandler.enablePongEvent();
      socketEventHandler.enableMessageEvent();
    });

    const interval = serverEventHandler.enableHeartbeat(30000);
    serverEventHandler.enableCloseEvent(() => {
      clearInterval(interval);
    });
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

  public getConnectedClients(): Set<ExtendedWebSocket> {
    return this.wss.clients as Set<ExtendedWebSocket>;
  }

  private get wss(): WebSocketServer {
    return this._wss;
  }
}

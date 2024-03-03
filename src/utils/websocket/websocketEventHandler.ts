import { ExtendedWebSocket } from "../../interfaces/extendedWebsocket";

export class WebsocketEventHandler {
  constructor(private webSocket: ExtendedWebSocket) {}

  public enableErrorEvent() {
    this.webSocket.on("error", console.error);
  }

  //needed for the heartbeat mechanism
  public enablePongEvent() {
    this.webSocket.on("pong", () => {
      this.webSocket.isAlive = true;
      console.log("Pong received");
    });
  }

  public enableDisconnectEvent() {
    this.webSocket.on("close", (code, mes) => {
      console.log("Code:", code, "Message:", mes.toString());
      console.log("WebSocket client disconnected");
    });
  }

  public enableMessageEvent() {
    this.webSocket.on("message", (data) => {
      const message = data.toString();
      console.log("Received message:", message);
      // just echo the message back to the client
      this.webSocket.send(message);
    });
  }
}

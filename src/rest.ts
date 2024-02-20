import express, { Application, Request, Response } from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { DecodedToken } from "./interfaces/decodedToken";

export class RestAPI {
  constructor(
    private app: Application,
    private webSocketServer: ExtendedWebSocketServer,
  ) {
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.post("/broadcast", (req: Request, res: Response) => {
      const message: string = req.body.message;

      this.webSocketServer.broadcast(message);

      res.status(200).send("Broadcast erfolgreich.");
    });

    this.app.post("/send-message", (req, res) => {
      const message = req.body.message;
      const users: Array<string> = req.body.users;

      users.forEach((user) =>
        this.webSocketServer.sendMessageToUser(user, message),
      );

      res.status(200).send("OK");
    });

    this.app.get("/all-clients", (req, res) => {
      const connectedClients = this.webSocketServer.getConnectedClients();

      const result: Array<DecodedToken> = [];

      connectedClients.forEach((client) => result.push(client.payload));

      res.status(200).send(result);
    });
  }
}

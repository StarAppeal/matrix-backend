import express, { Request, Response, Router } from "express";
import { ExtendedWebSocketServer } from "../websocket";
import { DecodedToken } from "../interfaces/decodedToken";

export class RestWebSocket {
  constructor(private webSocketServer: ExtendedWebSocketServer) {}

  public createRouter(): Router {
    const router = express.Router();

    router.post("/broadcast", (req: Request, res: Response) => {
      const payload: string = JSON.stringify(req.body.payload);

      console.log(payload);

      this.webSocketServer.broadcast(payload);

      res.status(200).send("OK");
    });

    router.post("/send-message", (req, res) => {
      const payload = JSON.stringify(req.body.payload);
      const users: Array<string> = req.body.users;

      users.forEach((user) =>
        this.webSocketServer.sendMessageToUser(user, payload),
      );

      res.status(200).send("OK");
    });

    router.get("/all-clients", (req, res) => {
      const connectedClients = this.webSocketServer.getConnectedClients();

      const result: Array<DecodedToken> = [];

      connectedClients.forEach((client) => result.push(client.payload));

      console.log("Connected clients:", result);

      res.status(200).send({ result });
    });

    router.get("/throw-error", (req, res) => {
      console.log("Throwing error");
      res.status(500).send("Internal Server Error");
    });

    return router;
  }
}

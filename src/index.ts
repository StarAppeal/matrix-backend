import express from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { RestAPI } from "./rest";

const app = express();
const server = app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

const webSocketServer = new ExtendedWebSocketServer(server);
const restAPI = new RestAPI(app, webSocketServer);

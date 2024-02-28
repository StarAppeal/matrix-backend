import express from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { UserService } from "./db/services/database.service";
import { RestUser } from "./rest/restUser";


const app = express();
const server = app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.use(express.json());

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser(UserService.create);

app.use("/api/websocket", restWebSocket.createRouter());
 app.use("/api/user", restUser.createRouter());

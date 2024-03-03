import express from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { UserService } from "./db/services/database.service";
import { RestUser } from "./rest/restUser";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(express.json());

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser(UserService.create);

app.use("/api/websocket", restWebSocket.createRouter());
app.use("/api/user", restUser.createRouter());

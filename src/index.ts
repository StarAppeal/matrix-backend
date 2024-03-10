import express from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { UserService } from "./db/services/database.service";
import { RestUser } from "./rest/restUser";
import { authenticateJwt } from "./rest/middleware/authenticateJwt";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(express.json({ limit: "15mb" }));

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser(UserService.create);

app.use("/api/websocket", authenticateJwt, restWebSocket.createRouter());
app.use("/api/user", authenticateJwt, restUser.createRouter());

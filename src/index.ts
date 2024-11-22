import express from "express";
import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { UserService } from "./db/services/database.service";
import { RestUser } from "./rest/restUser";
import { authenticateJwt } from "./rest/middleware/authenticateJwt";
import { JwtTokenPropertiesExtractor } from "./rest/jwtTokenPropertiesExtractor";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

if (process.env.NODE_ENV === "development") {
  console.log("development");
  app.use(cors({
    origin: 'http://localhost:8081', // Erlaube Anfragen von http://localhost:8081
  }));
}

app.use(express.json({ limit: "15mb" }));

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser(UserService.create);
const jwtTokenPropertiesExtractor = new JwtTokenPropertiesExtractor();

app.use("/api/websocket", authenticateJwt, restWebSocket.createRouter());
app.use("/api/user", authenticateJwt, restUser.createRouter());
app.use(
  "/api/jwt",
  authenticateJwt,
  jwtTokenPropertiesExtractor.createRouter(),
);

import express from "express";
import {ExtendedWebSocketServer} from "./websocket";
import {RestWebSocket} from "./rest/restWebSocket";
import {RestUser} from "./rest/restUser";
import {authenticateJwt} from "./rest/middleware/authenticateJwt";
import {JwtTokenPropertiesExtractor} from "./rest/jwtTokenPropertiesExtractor";
import cors from "cors";
import {SpotifyTokenGenerator} from "./rest/spotifyTokenGenerator";
import {RestAuth} from "./rest/auth";

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
app.use(cors({
    origin: process.env.FRONTEND_URL,
}));


app.use(express.json({limit: "15mb"}));

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser();
const auth = new RestAuth();
const jwtTokenPropertiesExtractor = new JwtTokenPropertiesExtractor();
const spotify = new SpotifyTokenGenerator();

app.use("/api/websocket", authenticateJwt, restWebSocket.createRouter());
app.use("/api/user", authenticateJwt, restUser.createRouter());
app.use(
    "/api/jwt",
    authenticateJwt,
    jwtTokenPropertiesExtractor.createRouter(),
);
app.use("/api/spotify", authenticateJwt, spotify.createRouter());

app.use("/api/auth", auth.createRouter());

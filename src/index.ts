import express from "express";
import {ExtendedWebSocketServer} from "./websocket";
import {RestWebSocket} from "./rest/restWebSocket";
import {RestUser} from "./rest/restUser";
import {authenticateJwt} from "./rest/middleware/authenticateJwt";
import {JwtTokenPropertiesExtractor} from "./rest/jwtTokenPropertiesExtractor";
import cors from "cors";
import {SpotifyTokenGenerator} from "./rest/spotifyTokenGenerator";
import {RestAuth} from "./rest/auth";
import { config } from "./config";
import cookieParser from 'cookie-parser';
import {authLimiter, spotifyLimiter} from "./rest/middleware/rateLimit";
import {cookieJwtAuth} from "./rest/middleware/cookieAuth";

const app = express();
const port = config.port;

app.set("trust proxy", 1);
app.use(cookieParser());

app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
}));

app.use((_req, res, next) => {
    res.set({
        "X-DNS-Prefetch-Control": "off",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "geolocation=()",
    });
    next();
});

app.use(express.json({limit: "2mb"}));

app.get("/api/healthz", (_req, res) => res.status(200).send({status: "ok"}));

const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const webSocketServer = new ExtendedWebSocketServer(server);
const restWebSocket = new RestWebSocket(webSocketServer);
const restUser = new RestUser();
const auth = new RestAuth();
const jwtTokenPropertiesExtractor = new JwtTokenPropertiesExtractor();
const spotify = new SpotifyTokenGenerator();

app.use("/api/auth", authLimiter, auth.createRouter());

app.use(cookieJwtAuth);
app.use("/api/spotify", authenticateJwt, spotifyLimiter, spotify.createRouter());

app.use("/api/websocket", authenticateJwt, restWebSocket.createRouter());
app.use("/api/user", authenticateJwt, restUser.createRouter());
app.use(
    "/api/jwt",
    authenticateJwt,
    jwtTokenPropertiesExtractor.createRouter(),
);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res
      .status(err?.status || 500)
      .send({ ok: false, data: {}, error: err?.message || "Internal Server Error" });
});

process.on("SIGTERM", () => {
    server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
    });
});

// Export the app for testing purposes
export default app; // optional

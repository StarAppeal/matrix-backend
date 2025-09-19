import express from "express";
import {ExtendedWebSocketServer} from "./websocket";
import {RestWebSocket} from "./rest/restWebSocket";
import {RestUser} from "./rest/restUser";
import {JwtTokenPropertiesExtractor} from "./rest/jwtTokenPropertiesExtractor";
import cors from "cors";
import {SpotifyTokenGenerator} from "./rest/spotifyTokenGenerator";
import {RestAuth} from "./rest/auth";
import {config} from "./config";
import cookieParser from 'cookie-parser';
import {authLimiter, spotifyLimiter} from "./rest/middleware/rateLimit";
import {extractTokenFromCookie} from "./rest/middleware/extractTokenFromCookie";
import {UserService} from "./db/services/db/UserService";
import {randomUUID} from "crypto";
import {JwtAuthenticator} from "./utils/jwtAuthenticator";
import {authenticateJwt} from "./rest/middleware/authenticateJwt";
import {disconnectFromDatabase} from "./db/services/db/database.service";

export async function startServer(jwtSecret: string) {
    const app = express();
    const port = config.port;

    app.set("trust proxy", 1);
    app.use(cookieParser());

    // test
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

    console.log("Connecting to database and creating UserService...");
    const userService = await UserService.create();
    console.log("UserService created successfully.");

    const _authenticateJwt = authenticateJwt(new JwtAuthenticator(jwtSecret));

    const server = app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    const webSocketServer = new ExtendedWebSocketServer(server, userService);
    const restWebSocket = new RestWebSocket(webSocketServer);
    const restUser = new RestUser(userService);
    const auth = new RestAuth(userService);
    const jwtTokenPropertiesExtractor = new JwtTokenPropertiesExtractor();
    const spotify = new SpotifyTokenGenerator();

    app.use("/api/auth", authLimiter, auth.createRouter());

    app.use(extractTokenFromCookie);
    app.use("/api/spotify", _authenticateJwt, spotifyLimiter, spotify.createRouter());
    app.use("/api/websocket", _authenticateJwt, restWebSocket.createRouter());
    app.use("/api/user", _authenticateJwt, restUser.createRouter());
    app.use(
        "/api/jwt",
        _authenticateJwt,
        jwtTokenPropertiesExtractor.createRouter(),
    );

    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const errorId = randomUUID();

        console.error(`Error ID: ${errorId} | Status: ${err?.status || 500} | Message: ${err?.message}`);
        console.error(`Stack Trace [${errorId}]:`, err.stack);

        const statusCode = err?.status || 500;
        let errorMessage = err?.message || "Internal Server Error";
        let errorResponse: { ok: boolean; data: { error: string; errorId?: string } } = {
            ok: false,
            data: {
                error: errorMessage,
            }
        };

        if (statusCode >= 500) {
            errorMessage = "An unexpected error occurred.";

            errorResponse = {
                ok: false,
                data: {
                    error: errorMessage,
                    errorId: errorId,
                }
            };
        }

        res.status(statusCode).send(errorResponse);
    });

    process.on("SIGTERM", async () => {
        console.log("SIGTERM signal received: closing HTTP server");
        await disconnectFromDatabase();
        server.close(() => {
            console.log("HTTP server closed");
            process.exit(0);
        });
    });



    return {app, server};
}


if (process.env.NODE_ENV !== 'test') {
    const JWT_SECRET = process.env.SECRET_KEY;

    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        console.error("CRITICAL ERROR: SECRET_KEY environment variable is not set or too short. Aborting.");
        process.exit(1);
    }

    startServer(JWT_SECRET).catch(error => {
        console.error("Fatal error during server startup:", error);
        process.exit(1);
    });
}
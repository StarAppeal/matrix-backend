import express, { Express, Request, Response, NextFunction } from "express";
import { Server as HttpServer } from "http";
import cors from "cors";
import cookieParser from 'cookie-parser';
import { randomUUID } from "crypto";

import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { RestUser } from "./rest/restUser";
import { JwtTokenPropertiesExtractor } from "./rest/jwtTokenPropertiesExtractor";
import { SpotifyTokenGenerator } from "./rest/spotifyTokenGenerator";
import { RestAuth } from "./rest/auth";
import { authLimiter, spotifyLimiter } from "./rest/middleware/rateLimit";
import { extractTokenFromCookie } from "./rest/middleware/extractTokenFromCookie";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import { authenticateJwt } from "./rest/middleware/authenticateJwt";
import {watchUserChanges} from "./db/models/userWatch";
import {SpotifyPollingService} from "./services/spotifyPollingService";
import {SpotifyApiService} from "./services/spotifyApiService";
import {UserService} from "./services/db/UserService";
import {connectToDatabase, disconnectFromDatabase} from "./services/db/database.service";
import {SpotifyTokenService} from "./services/spotifyTokenService";
import {WeatherPollingService} from "./services/weatherPollingService";

interface ServerConfig {
    port: number;
    jwtSecret: string;
    spotifyClientId: string;
    spotifyClientSecret: string;
    cors: {
        origin: string | string[];
        credentials: boolean;
    };
}

export class Server {
    public readonly app: Express;
    private httpServer: HttpServer | null = null;
    private userService: UserService | null = null;
    private webSocketServer: ExtendedWebSocketServer | null = null;

    constructor(private readonly config: ServerConfig) {
        this.app = express();
    }

    public async start(): Promise<HttpServer> {
        await connectToDatabase();

        watchUserChanges();

        this.userService = await UserService.create();
        const spotifyTokenService = new SpotifyTokenService(this.config.spotifyClientId, this.config.spotifyClientSecret);
        const spotifyApiService = new SpotifyApiService();

        const spotifyPollingService = new SpotifyPollingService(this.userService, spotifyApiService, spotifyTokenService);
        const weatherPollingService = new WeatherPollingService();

        this._setupMiddleware();
        this._setupRoutes(this.userService, spotifyTokenService);
        this._setupErrorHandling();

        this.httpServer = this.app.listen(this.config.port, () => {
            console.log(`Server is running on port ${this.config.port}`);
        });

        this.webSocketServer = new ExtendedWebSocketServer(this.httpServer, this.userService, spotifyPollingService, weatherPollingService);

        this._setupGracefulShutdown();

        return this.httpServer;
    }

    public async stop(): Promise<void> {
        console.log("Stopping server gracefully...");
        await disconnectFromDatabase();
        if (this.httpServer) {
            this.httpServer.close(() => {
                console.log("HTTP server closed.");
            });
        }
    }

    private _setupMiddleware(): void {
        this.app.set("trust proxy", 1);
        this.app.use(cookieParser());
        this.app.use(cors({
            origin: this.config.cors.origin,
            credentials: this.config.cors.credentials,
        }));
        this.app.use(this._securityHeaders);
        this.app.use(express.json({ limit: "2mb" }));
    }

    private _setupRoutes(userService: UserService, spotifyTokenService: SpotifyTokenService): void {
        const _authenticateJwt = authenticateJwt(new JwtAuthenticator(this.config.jwtSecret));

        const restAuth = new RestAuth(userService);
        const restUser = new RestUser(userService);
        const spotifyTokenGenerator = new SpotifyTokenGenerator(spotifyTokenService);
        const jwtTokenExtractor = new JwtTokenPropertiesExtractor();

        this.app.get("/api/healthz", (_req, res) => res.status(200).send({ status: "ok" }));

        this.app.use("/api/auth", authLimiter, restAuth.createRouter());

        this.app.use(extractTokenFromCookie);
        this.app.use("/api/spotify", _authenticateJwt, spotifyLimiter, spotifyTokenGenerator.createRouter());
        this.app.use("/api/user", _authenticateJwt, restUser.createRouter());
        this.app.use("/api/jwt", _authenticateJwt, jwtTokenExtractor.createRouter());

        this.app.use("/api/websocket", _authenticateJwt, (req, res, next) => {
            if (this.webSocketServer) {
                const restWebSocket = new RestWebSocket(this.webSocketServer);
                restWebSocket.createRouter()(req, res, next);
            } else {
                next(new Error("WebSocket server not initialized."));
            }
        });
    }

    private _securityHeaders(_req: Request, res: Response, next: NextFunction): void {
        res.set({
            "X-DNS-Prefetch-Control": "off",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Permissions-Policy": "geolocation=()",
        });
        next();
    }

    private _setupErrorHandling(): void {
        this.app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            const errorId = randomUUID();
            const statusCode = err?.status || 500;

            console.error(`Error ID: ${errorId} | Status: ${statusCode} | Message: ${err?.message}`);
            if (err.stack) {
                console.error(`Stack Trace [${errorId}]:`, err.stack);
            }

            let errorMessage = err?.message || "Internal Server Error";
            if (statusCode >= 500) {
                errorMessage = "An unexpected error occurred on the server.";
            }

            res.status(statusCode).send({
                ok: false,
                data: {
                    error: errorMessage,
                    ...(statusCode >= 500 && { errorId: errorId }),
                },
            });
        });
    }

    private _setupGracefulShutdown(): void {
        process.on("SIGTERM", async () => {
            console.log("SIGTERM signal received. Closing server gracefully.");
            await this.stop();
            process.exit(0);
        });
    }
}
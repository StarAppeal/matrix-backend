import express, { Express, Request, Response, NextFunction } from "express";
import { Server as HttpServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";

import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { RestUser } from "./rest/restUser";
import { JwtTokenPropertiesExtractor } from "./rest/jwtTokenPropertiesExtractor";
import { SpotifyTokenGenerator } from "./rest/spotifyTokenGenerator";
import { RestAuth } from "./rest/auth";
import { authLimiter, spotifyLimiter, weatherLimiter } from "./rest/middleware/rateLimit";
import { extractTokenFromCookie } from "./rest/middleware/extractTokenFromCookie";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import { authenticateJwt } from "./rest/middleware/authenticateJwt";
import { watchUserChanges } from "./db/models/userWatch";
import { SpotifyPollingService } from "./services/spotifyPollingService";
import { UserService } from "./services/db/UserService";
import { disconnectFromDatabase } from "./services/db/database.service";
import { SpotifyTokenService } from "./services/spotifyTokenService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { S3Service } from "./services/s3Service";
import { RestStorage } from "./rest/restStorage";
import logger from "./utils/logger";
import { RestLocation } from "./rest/restLocation";

interface ServerDependencies {
    userService: UserService;
    s3Service: S3Service;
    spotifyTokenService: SpotifyTokenService;
    spotifyPollingService: SpotifyPollingService;
    weatherPollingService: WeatherPollingService;
    jwtAuthenticator: JwtAuthenticator;
}

interface ServerConfig {
    port: number;
    jwtSecret: string;
    cors: {
        origin: string | string[];
        credentials: boolean;
    };
}

export class Server {
    public readonly app: Express;
    private httpServer: HttpServer | null = null;
    private webSocketServer: ExtendedWebSocketServer | null = null;

    constructor(
        private readonly config: ServerConfig,
        private readonly dependencies: ServerDependencies
    ) {
        this.app = express();
    }

    public async start(): Promise<HttpServer> {
        const {
            userService,
            s3Service,
            spotifyTokenService,
            spotifyPollingService,
            weatherPollingService,
            jwtAuthenticator,
        } = this.dependencies;

        await s3Service.ensureBucketExists();

        watchUserChanges();

        this._setupMiddleware();
        this._setupRoutes(userService, spotifyTokenService, jwtAuthenticator, s3Service);
        this._setupErrorHandling();

        this.httpServer = this.app.listen(this.config.port, () => {
            logger.info(`Server started and listening on port ${this.config.port}`);
        });

        this.webSocketServer = new ExtendedWebSocketServer(
            this.httpServer,
            userService,
            spotifyPollingService,
            weatherPollingService,
            jwtAuthenticator
        );

        this._setupGracefulShutdown();

        return this.httpServer;
    }

    public async stop(): Promise<void> {
        logger.info("Shutting down server gracefully...");
        await disconnectFromDatabase();
        if (this.httpServer) {
            this.httpServer.close(() => {
                logger.info("HTTP server closed successfully");
            });
        }
    }

    private _setupMiddleware(): void {
        this.app.set("trust proxy", 1);
        this.app.use(cookieParser());
        this.app.use(
            cors({
                origin: this.config.cors.origin,
                credentials: this.config.cors.credentials,
            })
        );
        this.app.use(this._securityHeaders);
        this.app.use(express.json({ limit: "2mb" }));
    }

    private _setupRoutes(
        userService: UserService,
        spotifyTokenService: SpotifyTokenService,
        jwtAuthenticator: JwtAuthenticator,
        s3Service: S3Service
    ): void {
        const _authenticateJwt = authenticateJwt(jwtAuthenticator);

        const restAuth = new RestAuth(userService, jwtAuthenticator);
        const restUser = new RestUser(userService);
        const spotifyTokenGenerator = new SpotifyTokenGenerator(spotifyTokenService);
        const jwtTokenExtractor = new JwtTokenPropertiesExtractor();
        const storage = new RestStorage(s3Service);
        const restLocation = new RestLocation();

        this.app.get("/api/healthz", (_req, res) => res.status(200).send({ status: "ok" }));

        this.app.use("/api/auth", authLimiter, restAuth.createRouter());

        this.app.use(extractTokenFromCookie);
        this.app.use("/api/spotify", _authenticateJwt, spotifyLimiter, spotifyTokenGenerator.createRouter());
        this.app.use("/api/user", _authenticateJwt, restUser.createRouter());
        this.app.use("/api/jwt", _authenticateJwt, jwtTokenExtractor.createRouter());
        this.app.use("/api/storage", _authenticateJwt, storage.createRouter());
        this.app.use("/api/location", _authenticateJwt, weatherLimiter, restLocation.createRouter());

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
        this.app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
            const errorId = randomUUID();
            const statusCode = err?.status || 500;

            logger.error(`Error ID: ${errorId} | Status: ${statusCode} | Message: ${err?.message}`);
            if (err.stack) {
                logger.error(`Stack Trace [${errorId}]:`, err.stack);
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
            logger.info("SIGTERM signal received. Closing server gracefully.");
            await this.stop();
            process.exit(0);
        });
    }
}

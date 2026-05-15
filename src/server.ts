import express, { Express, Request, Response, NextFunction } from "express";
import { Server as HttpServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";

import { ExtendedWebSocketServer } from "./websocket";
import { RestWebSocket } from "./rest/restWebSocket";
import { RestUser } from "./rest/restUser";
import { JwtTokenPropertiesExtractor } from "./rest/jwtTokenPropertiesExtractor";
import { RestAuth } from "./rest/auth";
import { authLimiter, weatherLimiter } from "./rest/middleware/rateLimit";
import { extractTokenFromCookie } from "./rest/middleware/extractTokenFromCookie";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import { authenticateJwt } from "./rest/middleware/authenticateJwt";
import { watchUserChanges } from "./db/models/userWatch";
import { UserService } from "./services/db/UserService";
import { disconnectFromDatabase } from "./services/db/database.service";
import { WeatherPollingService } from "./services/weatherPollingService";
import { S3Service } from "./services/s3Service";
import { RestStorage } from "./rest/restStorage";
import logger from "./utils/logger";
import { RestLocation } from "./rest/restLocation";
import { MusicPollingService } from "./services/musicPollingService";
import { LastFmApiService } from "./services/lastFmApiService";
import { TamagotchiPollingService } from "./services/tamagotchiPollingService";
import { OwmApiService } from "./services/owmApiService";
import { TamagotchiService } from "./services/db/tamagotchiService";
import { RestTamagotchi } from "./rest/restTamagotchi";
import { RestAdmin } from "./rest/restAdmin";
import { FileService } from "./services/db/fileService";

interface ServerDependencies {
    userService: UserService;
    s3Service: S3Service;
    fileService: FileService;
    musicPollingService: MusicPollingService;
    weatherPollingService: WeatherPollingService;
    tamagotchiService: TamagotchiService;
    tamagotchiPollingService: TamagotchiPollingService;
    jwtAuthenticator: JwtAuthenticator;
    lastFmApiService: LastFmApiService;
    owmApiService: OwmApiService;
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
            fileService,
            musicPollingService,
            weatherPollingService,
            tamagotchiService,
            tamagotchiPollingService,
            jwtAuthenticator,
            lastFmApiService,
            owmApiService,
        } = this.dependencies;

        await s3Service.ensureBucketExists();

        this._runS3MatrixMigration(s3Service, fileService);

        watchUserChanges();

        this._setupMiddleware();
        this._setupRoutes(userService, jwtAuthenticator, s3Service, lastFmApiService, owmApiService, tamagotchiService);
        this._setupErrorHandling();

        this.httpServer = this.app.listen(this.config.port, () => {
            logger.info(`Server started and listening on port ${this.config.port}`);
        });

        this.webSocketServer = new ExtendedWebSocketServer(
            this.httpServer,
            userService,
            musicPollingService,
            weatherPollingService,
            tamagotchiPollingService,
            s3Service,
            jwtAuthenticator
        );

        this._setupGracefulShutdown();

        return this.httpServer;
    }

    public async stop(): Promise<void> {
        logger.info("Shutting down server gracefully...");
        await disconnectFromDatabase();
        await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
        this.webSocketServer?.closeServer();
        logger.info("Server shutdown complete.");
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
        jwtAuthenticator: JwtAuthenticator,
        s3Service: S3Service,
        lastFmApiService: LastFmApiService,
        owmApiService: OwmApiService,
        tamagotchiService: TamagotchiService
    ): void {
        const _authenticateJwt = authenticateJwt(jwtAuthenticator);

        const restAuth = new RestAuth(userService, jwtAuthenticator);
        const restUser = new RestUser(userService, lastFmApiService, owmApiService);
        const jwtTokenExtractor = new JwtTokenPropertiesExtractor();
        const storage = new RestStorage(s3Service);
        const restLocation = new RestLocation(owmApiService);
        const restTamagotchi = new RestTamagotchi(tamagotchiService);
        const restAdmin = new RestAdmin(userService, jwtAuthenticator, tamagotchiService, () => this.webSocketServer);

        this.app.get("/api/healthz", (_req, res) => res.status(200).send({ status: "ok" }));

        this.app.use("/api/auth", authLimiter, restAuth.createRouter());

        this.app.use(extractTokenFromCookie);
        this.app.use("/api/user", _authenticateJwt, restUser.createRouter());
        this.app.use("/api/jwt", _authenticateJwt, jwtTokenExtractor.createRouter());
        this.app.use("/api/storage", _authenticateJwt, storage.createRouter());
        this.app.use("/api/location", _authenticateJwt, weatherLimiter, restLocation.createRouter());
        this.app.use("/api/tamagotchi", _authenticateJwt, restTamagotchi.createRouter());
        this.app.use("/api/admin", _authenticateJwt, restAdmin.createRouter());

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

//TODO: remove
    private async _runS3MatrixMigration(s3Service: S3Service, fileService: FileService): Promise<void> {
        try {
            const allFiles = await fileService.getAllFiles();
            if (allFiles.length === 0) return;

            logger.info(`[Migration] Starting S3 migration for ${allFiles.length} files...`);

            let successCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const file of allFiles) {
                try {
                    const wasMigrated = await s3Service.migrateFileToIncludeMatrix(file.objectKey, file.mimeType);

                    if (wasMigrated) {
                        successCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    logger.error(`[Migration] Error at ${file.objectKey}:`, error);
                    errorCount++;
                }
            }

            if (successCount > 0 || errorCount > 0) {
                logger.info(
                    `[Migration] Done! Successful: ${successCount}, Skipped: ${skippedCount}, Error: ${errorCount}`
                );
            } else {
                logger.info(`[Migration] ${skippedCount} were already updated .`);
            }
        } catch (error) {
            logger.error("[Migration] Critical error running migration:", error);
        }
    }
}

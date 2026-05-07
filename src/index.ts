import { Server } from "./server";
import { config as baseConfig } from "./config/config";
import { S3ClientConfig, S3Service } from "./services/s3Service";
import { UserService } from "./services/db/UserService";
import { connectToDatabase } from "./services/db/database.service";
import { LastFmApiService } from "./services/lastFmApiService";
import { MusicPollingService } from "./services/musicPollingService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import { FileService } from "./services/db/fileService";
import logger from "./utils/logger";
import { TamagotchiPollingService } from "./services/tamagotchiPollingService";
import { TamagotchiService } from "./services/db/tamagotchiService";
import { HttpClient } from "./utils/httpClient";
import { OwmApiService } from "./services/owmApiService";

async function bootstrap() {
    const {
        SECRET_KEY,
        MINIO_ENDPOINT,
        MINIO_PORT,
        MINIO_BUCKET_NAME,
        MINIO_ROOT_USER,
        MINIO_ROOT_PASSWORD,
        DB_NAME,
        DB_CONN_STRING,
        MINIO_SERVER_URL,
        LAST_FM_API_KEY,
        OWM_API_KEY,
    } = process.env;

    if (!SECRET_KEY || SECRET_KEY.length < 32) {
        throw new Error("CRITICAL ERROR: SECRET_KEY environment variable is not set or too short.");
    }

    if (!MINIO_ENDPOINT || !MINIO_PORT) {
        throw new Error("MINIO_ENDPOINT and/or MINIO_PORT environment variable is not set.");
    }

    if (!MINIO_ROOT_USER || !MINIO_ROOT_PASSWORD) {
        throw new Error("MINIO_ROOT_USER and/or MINIO_ROOT_PASSWORD environment variable is not set.");
    }

    if (!MINIO_BUCKET_NAME) {
        throw new Error("MINIO_BUCKET_NAME environment variable is not set.");
    }

    if (!MINIO_SERVER_URL) {
        throw new Error("MINIO_SERVER_URL environment variable is not set.");
    }

    if (!DB_NAME || !DB_CONN_STRING) {
        throw new Error("DB_NAME and/or DB_CONN_STRING environment variable is not set.");
    }

    if (!LAST_FM_API_KEY) {
        throw new Error("CRITICAL ERROR: LAST_FM_API_KEY environment variable is not set.");
    }

    if (!OWM_API_KEY) {
        throw new Error("CRITICAL ERROR: OWM_API_KEY environment variable is not set.");
    }

    const s3ClientConfig: S3ClientConfig = {
        publicUrl: MINIO_SERVER_URL,
        endpoint: MINIO_ENDPOINT,
        port: parseInt(MINIO_PORT),
        accessKey: MINIO_ROOT_USER,
        secretAccessKey: MINIO_ROOT_PASSWORD,
        bucket: MINIO_BUCKET_NAME,
    };

    const dbConfig = {
        dbName: DB_NAME,
        dbConnString: DB_CONN_STRING,
    };

    await connectToDatabase(dbConfig.dbName, dbConfig.dbConnString);

    const fileService = FileService.getInstance();
    const s3Service = S3Service.getInstance(s3ClientConfig, fileService);
    const userService = new UserService();

    const lastFmApiService = new LastFmApiService(
        LAST_FM_API_KEY,
        new HttpClient({
            baseURL: "https://ws.audioscrobbler.com/2.0/",
            timeout: 5000,
        })
    );
    const owmApiService = new OwmApiService(OWM_API_KEY);
    const musicPollingService = new MusicPollingService(userService, lastFmApiService);
    const weatherPollingService = new WeatherPollingService(owmApiService);
    const tamagotchiService = new TamagotchiService();
    const tamagotchiPollingService = new TamagotchiPollingService(tamagotchiService);

    const jwtAuthenticator = new JwtAuthenticator(SECRET_KEY);

    const server = new Server(
        {
            port: baseConfig.port,
            jwtSecret: SECRET_KEY,
            cors: baseConfig.cors,
        },
        {
            s3Service,
            userService,
            musicPollingService,
            weatherPollingService,
            tamagotchiService,
            tamagotchiPollingService,
            jwtAuthenticator,
            lastFmApiService,
            owmApiService,
        }
    );

    await server.start();
}

if (process.env.NODE_ENV !== "test") {
    bootstrap().catch((error) => {
        logger.error("Fatal error during server startup:", error);
        process.exit(1);
    });
}

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
import { ImageServiceFactory } from "./services/imageService";
import { CacheService } from "./services/cacheService";

async function bootstrap() {
    const {
        SECRET_KEY,
        DB_NAME,
        DB_CONN_STRING,
        LAST_FM_API_KEY,
        OWM_API_KEY,
        S3_ENDPOINT,
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        S3_BUCKET_NAME,
    } = process.env;

    if (!SECRET_KEY || SECRET_KEY.length < 32) {
        throw new Error("CRITICAL ERROR: SECRET_KEY environment variable is not set or too short.");
    }

    if (!S3_ENDPOINT) {
        throw new Error("S3_ENDPOINT environment variable is not set.");
    }

    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
        throw new Error("S3_ACCESS_KEY_ID and/or S3_SECRET_ACCESS_KEY environment variable is not set.");
    }

    if (!S3_BUCKET_NAME) {
        throw new Error("S3_BUCKET_NAME environment variable is not set.");
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
        accessKey: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
        bucket: S3_BUCKET_NAME,
        endpoint: S3_ENDPOINT,
    };

    const dbConfig = {
        dbName: DB_NAME,
        dbConnString: DB_CONN_STRING,
    };

    await connectToDatabase(dbConfig.dbName, dbConfig.dbConnString);

    const fileService = FileService.getInstance();
    const s3Service = S3Service.getInstance(s3ClientConfig, fileService);
    const userService = new UserService();

    const imageHttpClient = new HttpClient({
        timeout: 10000,
    });

    const cacheService = new CacheService();

    const imageServiceFactory = new ImageServiceFactory(imageHttpClient, cacheService);

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
            imageServiceFactory,
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

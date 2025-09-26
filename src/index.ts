import { Server } from "./server";
import { config as baseConfig } from "./config/config";
import { S3ClientConfig, S3Service } from "./services/s3Service";
import { UserService } from "./services/db/UserService";
import { SpotifyTokenService } from "./services/spotifyTokenService";
import { connectToDatabase } from "./services/db/database.service";
import { SpotifyApiService } from "./services/spotifyApiService";
import { SpotifyPollingService } from "./services/spotifyPollingService";
import { WeatherPollingService } from "./services/weatherPollingService";
import { JwtAuthenticator } from "./utils/jwtAuthenticator";
import { FileService } from "./services/db/fileService";

async function bootstrap() {
    const {
        SECRET_KEY,
        SPOTIFY_CLIENT_ID,
        SPOTIFY_CLIENT_SECRET,
        MINIO_ENDPOINT,
        MINIO_PORT,
        MINIO_BUCKET_NAME,
        MINIO_ROOT_USER,
        MINIO_ROOT_PASSWORD,
        DB_NAME,
        DB_CONN_STRING,
        MINIO_SERVER_URL,
    } = process.env;

    if (!SECRET_KEY || SECRET_KEY.length < 32) {
        throw new Error("CRITICAL ERROR: SECRET_KEY environment variable is not set or too short.");
    }
    if (!SPOTIFY_CLIENT_ID) {
        throw new Error("CRITICAL ERROR: SPOTIFY_CLIENT_ID environment variable is not set.");
    }
    if (!SPOTIFY_CLIENT_SECRET) {
        throw new Error("CRITICAL ERROR: SPOTIFY_CLIENT_SECRET environment variable is not set.");
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
    const userService = await UserService.create();
    const spotifyTokenService = new SpotifyTokenService(SPOTIFY_CLIENT_ID!, SPOTIFY_CLIENT_SECRET!);

    const spotifyApiService = new SpotifyApiService();
    const spotifyPollingService = new SpotifyPollingService(userService, spotifyApiService, spotifyTokenService);
    const weatherPollingService = new WeatherPollingService();

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
            spotifyTokenService,
            spotifyPollingService,
            weatherPollingService,
            jwtAuthenticator,
        }
    );

    await server.start();
}

if (process.env.NODE_ENV !== "test") {
    bootstrap().catch((error) => {
        console.error("Fatal error during server startup:", error.message);
        process.exit(1);
    });
}

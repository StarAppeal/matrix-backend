
import { Server } from "./server";
import { config as baseConfig} from "./config";

async function bootstrap() {
    const { SECRET_KEY, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

    if (!SECRET_KEY || SECRET_KEY.length < 32) {
        throw new Error("CRITICAL ERROR: SECRET_KEY environment variable is not set or too short.");
    }
    if (!SPOTIFY_CLIENT_ID) {
        throw new Error("CRITICAL ERROR: SPOTIFY_CLIENT_ID environment variable is not set.");
    }
    if (!SPOTIFY_CLIENT_SECRET) {
        throw new Error("CRITICAL ERROR: SPOTIFY_CLIENT_SECRET environment variable is not set.");
    }

    const server = new Server({
        port: baseConfig.port,
        jwtSecret: SECRET_KEY,
        spotifyClientId: SPOTIFY_CLIENT_ID,
        spotifyClientSecret: SPOTIFY_CLIENT_SECRET,
        cors: baseConfig.cors,
    });

    await server.start();
}

if (process.env.NODE_ENV !== 'test') {
    bootstrap().catch(error => {
        console.error("Fatal error during server startup:", error.message);
        process.exit(1);
    });
}
import "dotenv/config";
import mongoose, { ConnectOptions } from "mongoose";
import logger from "../../utils/logger";

let isConnected: boolean = false;
let connectionPromise: Promise<void> | null = null;

const connectWithRetry = async (dbName: string, dbConnString: string): Promise<void> => {
    const options: ConnectOptions = {
        dbName: dbName,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        keepAliveInitialDelay: 300000,
    };

    try {
        logger.debug("Attempting to connect to MongoDB...");
        await mongoose.connect(dbConnString, options);
    } catch (error) {
        logger.error("Failed to connect to MongoDB. Retrying in 5 seconds...", error);
        await new Promise<void>((resolve) => setTimeout(resolve, 5000));
        return connectWithRetry(dbName, dbConnString);
    }
};

export async function connectToDatabase(dbName: string, dbConnString: string): Promise<void> {
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async (): Promise<void> => {
        if (isConnected) {
            logger.debug("Already connected to MongoDB.");
            return;
        }

        mongoose.connection.on("connected", () => {
            isConnected = true;
            logger.info("Mongoose connected to DB.");
        });

        mongoose.connection.on("disconnected", () => {
            isConnected = false;
            logger.warn("Mongoose disconnected from DB. Attempting to reconnect...");
        });

        mongoose.connection.on("error", (err: Error) => {
            isConnected = false;
            logger.error("Mongoose connection error:", err);
        });

        await connectWithRetry(dbName, dbConnString);
    })();

    return connectionPromise;
}

export async function disconnectFromDatabase(): Promise<void> {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        connectionPromise = null;
        console.log("Disconnected from MongoDB.");
    }
}

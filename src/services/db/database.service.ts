import "dotenv/config";
import mongoose, { ConnectOptions } from "mongoose";

let isConnected: boolean = false;
let connectionPromise: Promise<void> | null = null;

const connectWithRetry = async (): Promise<void> => {
    const dbConnString: string | undefined = process.env.DB_CONN_STRING;
    const dbName: string | undefined = process.env.DB_NAME;

    if (!dbConnString) {
        throw new Error("Missing environment variable: DB_CONN_STRING is required for database connection.");
    }
    if (!dbName) {
        throw new Error("Missing environment variable: DB_NAME is required for database connection.");
    }

    const options: ConnectOptions = {
        dbName: dbName,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        keepAliveInitialDelay: 300000,
    };

    try {
        console.log("Attempting to connect to MongoDB...");
        await mongoose.connect(dbConnString, options);
    } catch (error) {
        console.error("Failed to connect to MongoDB. Retrying in 5 seconds...", error);
        await new Promise<void>(resolve => setTimeout(resolve, 5000));
        return connectWithRetry();
    }
};

export async function connectToDatabase(): Promise<void> {
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async (): Promise<void> => {
        if (isConnected) {
            console.log("Already connected to MongoDB.");
            return;
        }

        mongoose.connection.on('connected', () => {
            isConnected = true;
            console.log('Mongoose connected to DB.');
        });

        mongoose.connection.on('disconnected', () => {
            isConnected = false;
            console.warn('Mongoose disconnected from DB. Attempting to reconnect...');
        });

        mongoose.connection.on('error', (err: Error) => {
            isConnected = false;
            console.error('Mongoose connection error:', err);
        });

        await connectWithRetry();
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

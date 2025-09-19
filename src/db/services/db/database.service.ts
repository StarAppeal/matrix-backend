import "dotenv/config";

import mongoose from "mongoose";

let isConnected = false;

export async function connectToDatabase() {
    if (isConnected) {
        console.log("Already connected to MongoDB.");
        return;
    }
    const dbConnString = process.env.DB_CONN_STRING;
    const dbName = process.env.DB_NAME;

    if (!dbConnString) {
        throw new Error("Missing environment variable: DB_CONN_STRING is required for database connection.");
    }
    if (!dbName) {
        throw new Error("Missing environment variable: DB_NAME is required for database connection.");
    }
    try {
        await mongoose.connect(dbConnString, {
            dbName: dbName,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        isConnected = true;
        console.log("Connected to MongoDB with Mongoose");

        mongoose.connection.on('disconnected', () => {
            // TODO: add reconnecting
            console.warn('Mongoose disconnected from DB. Attempting to reconnect...');
            isConnected = false;
        });
        mongoose.connection.on('error', (err) => {
            console.error('Mongoose connection error:', err);
            isConnected = false;
        });

    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }

}

import "dotenv/config";

import mongoose from "mongoose";

export async function connectToDatabase() {
    await mongoose.connect(process.env.DB_CONN_STRING!, {
        dbName: process.env.DB_NAME!,
        serverApi: {version: '1', strict: true, deprecationErrors: true}
    });

    console.log("Connected to MongoDB with Mongoose");
}

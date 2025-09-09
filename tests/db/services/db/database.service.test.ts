import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase } from "../../../../src/db/services/db/database.service";

vi.mock("mongoose");
vi.mock("dotenv/config", () => ({}));

describe("database.service", () => {
    const mockedMongooseConnect = vi.mocked(mongoose.connect);

    let consoleLogSpy: Mocked<typeof console.log>;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {}) as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    describe("connectToDatabase", () => {

        describe("Success Scenarios", () => {
            beforeEach(() => {
                mockedMongooseConnect.mockResolvedValue(undefined as any);
            });

            it("should connect using the correct environment variables", async () => {
                vi.stubEnv('DB_CONN_STRING', 'mongodb://localhost:27017/test');
                vi.stubEnv('DB_NAME', 'test_database');

                await connectToDatabase();

                expect(mockedMongooseConnect).toHaveBeenCalledWith(
                    "mongodb://localhost:27017/test",
                    { dbName: "test_database" }
                );
            });

            it("should log a success message on connection", async () => {
                vi.stubEnv('DB_CONN_STRING', 'mongodb://any');
                vi.stubEnv('DB_NAME', 'any');

                await connectToDatabase();

                expect(consoleLogSpy).toHaveBeenCalledWith("Connected to MongoDB with Mongoose");
            });

            it("should resolve to undefined on successful connection", async () => {
                vi.stubEnv('DB_CONN_STRING', 'mongodb://any');
                vi.stubEnv('DB_NAME', 'any');

                await expect(connectToDatabase()).resolves.toBeUndefined();
            });

            it("should handle different connection string formats (e.g., Atlas)", async () => {
                vi.stubEnv('DB_CONN_STRING', 'mongodb+srv://user:pass@cluster.mongodb.net/');
                vi.stubEnv('DB_NAME', 'cloud_database');

                await connectToDatabase();

                expect(mockedMongooseConnect).toHaveBeenCalledWith(
                    "mongodb+srv://user:pass@cluster.mongodb.net/",
                    { dbName: "cloud_database" }
                );
            });
        });

        describe("Failure Scenarios", () => {
            it("should propagate connection errors and not log success", async () => {
                const connectionError = new Error("Connection failed");
                mockedMongooseConnect.mockRejectedValue(connectionError);
                vi.stubEnv('DB_CONN_STRING', 'mongodb://fail');
                vi.stubEnv('DB_NAME', 'fail_db');

                await expect(connectToDatabase()).rejects.toThrow(connectionError);

                expect(consoleLogSpy).not.toHaveBeenCalledWith("Connected to MongoDB with Mongoose");
            });

            it("should handle specific Mongoose errors (e.g., MongoAuthenticationError)", async () => {
                const authError = Object.assign(new Error("Authentication failed"), { name: "MongoAuthenticationError" });
                mockedMongooseConnect.mockRejectedValue(authError);
                vi.stubEnv('DB_CONN_STRING', 'mongodb://fail');
                vi.stubEnv('DB_NAME', 'fail_db');

                await expect(connectToDatabase()).rejects.toThrow(authError);
            });
        });
    });
});
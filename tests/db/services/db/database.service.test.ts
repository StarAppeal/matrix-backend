import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

const MODULE_PATH = "../../../../src/db/services/db/database.service";

type SpyInstance<T extends (...args: any) => any> = ReturnType<typeof vi.spyOn<any, Parameters<T>[0]>>;

vi.mock("mongoose", async (importOriginal) => {
    const originalMongoose = await importOriginal<typeof mongoose>();
    const mockConnection = {
        on: vi.fn(),
    };
    return {
        ...originalMongoose,
        default: {
            ...originalMongoose.default,
            connect: vi.fn(),
            disconnect: vi.fn(),
            connection: mockConnection,
        },
    };
});

vi.mock("dotenv/config", () => ({}));

const mockedMongooseConnect = vi.mocked(mongoose.connect);
const mockedMongooseDisconnect = vi.mocked(mongoose.disconnect);
const mockedConnectionOn = vi.mocked(mongoose.connection.on);

describe("database.service", () => {
    let consoleLogSpy: SpyInstance<typeof console.log>;
    let consoleErrorSpy: SpyInstance<typeof console.error>;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.unstubAllEnvs();

        vi.stubEnv('DB_CONN_STRING', 'mongodb://test-host/testdb');
        vi.stubEnv('DB_NAME', 'testdb');

        consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("connectToDatabase", () => {
        it("should throw error,when DB_CONN_STRING is not set", async () => {
            vi.unstubAllEnvs();
            vi.stubEnv('DB_NAME', 'testdb');
            const { connectToDatabase } = await import(MODULE_PATH);

            await expect(connectToDatabase()).rejects.toThrow(
                "Missing environment variable: DB_CONN_STRING is required for database connection."
            );
        });

        it("should throw error, when DB_NAME is not set", async () => {
            vi.unstubAllEnvs();
            vi.stubEnv('DB_CONN_STRING', 'mongodb://test-host/testdb');
            const { connectToDatabase } = await import(MODULE_PATH);

            await expect(connectToDatabase()).rejects.toThrow(
                "Missing environment variable: DB_NAME is required for database connection."
            );
        });

        it("should connect successfully first try", async () => {
            mockedMongooseConnect.mockResolvedValueOnce(undefined as any);
            const { connectToDatabase } = await import(MODULE_PATH);

            await connectToDatabase();

            expect(mockedMongooseConnect).toHaveBeenCalledTimes(1);
            expect(mockedMongooseConnect).toHaveBeenCalledWith('mongodb://test-host/testdb', expect.any(Object));
            expect(consoleLogSpy).toHaveBeenCalledWith("Attempting to connect to MongoDB...");
        });

        it("should configure event-listeners", async () => {
            mockedMongooseConnect.mockResolvedValueOnce(undefined as any);
            const { connectToDatabase } = await import(MODULE_PATH);

            await connectToDatabase();

            expect(mockedConnectionOn).toHaveBeenCalledWith('connected', expect.any(Function));
            expect(mockedConnectionOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
            expect(mockedConnectionOn).toHaveBeenCalledWith('error', expect.any(Function));
        });

        describe("Singleton", () => {
            it("should try to connect once, even if called multiple times", async () => {
                mockedMongooseConnect.mockResolvedValue(undefined as any);
                const { connectToDatabase } = await import(MODULE_PATH);

                const promise1 = connectToDatabase();
                const promise2 = connectToDatabase();

                await Promise.all([promise1, promise2]);

                expect(mockedMongooseConnect).toHaveBeenCalledTimes(1);
            });
        });

        describe("Retry Logic", () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });
            afterEach(() => {
                vi.useRealTimers();
            });

            it("should retry after 5 seconds when first time fails", async () => {
                const connectionError = new Error("DB not ready");
                mockedMongooseConnect
                    .mockRejectedValueOnce(connectionError)
                    .mockResolvedValueOnce(undefined as any);

                const { connectToDatabase } = await import(MODULE_PATH);
                const connectionPromise = connectToDatabase();

                await vi.advanceTimersByTimeAsync(1);

                expect(mockedMongooseConnect).toHaveBeenCalledTimes(1);
                expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to connect to MongoDB. Retrying in 5 seconds...", connectionError);

                await vi.advanceTimersByTimeAsync(5000);

                expect(mockedMongooseConnect).toHaveBeenCalledTimes(2);

                await expect(connectionPromise).resolves.toBeUndefined();
            });
        });
    });

    describe("disconnectFromDatabase", () => {
        it("should call mongoose.disconnect, when connection is established", async () => {
            mockedMongooseConnect.mockResolvedValue(undefined as any);
            mockedMongooseDisconnect.mockResolvedValue(undefined as any);
            const { connectToDatabase, disconnectFromDatabase } = await import(MODULE_PATH);

            await connectToDatabase();

            const connectedCallback = mockedConnectionOn.mock.calls.find(call => call[0] === 'connected')?.[1];
            if (connectedCallback) {
                connectedCallback();
            }

            await disconnectFromDatabase();

            expect(mockedMongooseDisconnect).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy).toHaveBeenCalledWith("Disconnected from MongoDB.");
        });

        it("should NOT call.disconnect NICHT, when no connection is established", async () => {
            const { disconnectFromDatabase } = await import(MODULE_PATH);

            await disconnectFromDatabase();

            expect(mockedMongooseDisconnect).not.toHaveBeenCalled();
        });
    });
});
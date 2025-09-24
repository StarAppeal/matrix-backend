import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('mongoose', async (importOriginal) => {
    const originalMongoose = await importOriginal<typeof mongoose>();

    return {
        default: {
            ...originalMongoose.default,
            connect: vi.fn(),
            disconnect: vi.fn(),
            connection: {
                on: vi.fn(),
            },
        },
    };
});

const mockedMongooseConnect = vi.mocked(mongoose.connect);
const mockedMongooseDisconnect = vi.mocked(mongoose.disconnect);
const mockedConnectionOn = vi.mocked(mongoose.connection.on);


describe('database.service', () => {

    let connectToDatabase: any;
    let disconnectFromDatabase: any;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const dbService = await import('../../../src/services/db/database.service');
        connectToDatabase = dbService.connectToDatabase;
        disconnectFromDatabase = dbService.disconnectFromDatabase;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const TEST_DB_NAME = 'testdb';
    const TEST_DB_CONN_STRING = 'mongodb://test-host/testdb';

    describe('connectToDatabase', () => {
        it('should attempt to connect to MongoDB with correct options', async () => {
            mockedMongooseConnect.mockResolvedValue(undefined as any);

            await connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);

            expect(mockedMongooseConnect).toHaveBeenCalledOnce();
            expect(mockedMongooseConnect).toHaveBeenCalledWith(TEST_DB_CONN_STRING, expect.objectContaining({
                dbName: TEST_DB_NAME,
                family: 4,
            }));
        });

        it('should correctly set up event listeners on the connection', async () => {
            mockedMongooseConnect.mockResolvedValue(undefined as any);

            await connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);

            expect(mockedConnectionOn).toHaveBeenCalledWith('connected', expect.any(Function));
            expect(mockedConnectionOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
            expect(mockedConnectionOn).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockedConnectionOn).toHaveBeenCalledTimes(3);
        });

        it('should only attempt to connect once when called multiple times (singleton pattern)', async () => {
            mockedMongooseConnect.mockResolvedValue(undefined as any);

            // Rufe die Funktion mehrmals parallel auf
            const promise1 = connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);
            const promise2 = connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);

            await Promise.all([promise1, promise2]);

            expect(mockedMongooseConnect).toHaveBeenCalledOnce();
        });

        describe('Retry Logic', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });
            afterEach(() => {
                vi.useRealTimers();
            });

            it('should retry connecting after a 5-second delay if the first attempt fails', async () => {
                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                const connectionError = new Error('Database unavailable');

                mockedMongooseConnect
                    .mockRejectedValueOnce(connectionError)
                    .mockResolvedValueOnce(undefined as any);

                const connectionPromise = connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);

                await vi.runAllTicks();

                expect(mockedMongooseConnect).toHaveBeenCalledOnce();
                expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to connect to MongoDB. Retrying in 5 seconds...", connectionError);

                await vi.advanceTimersByTimeAsync(5000);

                expect(mockedMongooseConnect).toHaveBeenCalledTimes(2);

                await expect(connectionPromise).resolves.toBeUndefined();
                consoleErrorSpy.mockRestore();
            });
        });
    });

    describe('disconnectFromDatabase', () => {
        it('should call mongoose.disconnect if the connection is established', async () => {
            mockedMongooseConnect.mockResolvedValue(undefined as any);
            mockedMongooseDisconnect.mockResolvedValue(undefined as any);

            await connectToDatabase(TEST_DB_NAME, TEST_DB_CONN_STRING);

            const connectedCallback = mockedConnectionOn.mock.calls.find(call => call[0] === 'connected')?.[1];
            if (typeof connectedCallback === 'function') {
                connectedCallback();
            } else {
                throw new Error("Connected callback was not found or is not a function");
            }

            await disconnectFromDatabase();

            expect(mockedMongooseDisconnect).toHaveBeenCalledOnce();
        });

        it('should not call mongoose.disconnect if the connection was never established', async () => {
            await disconnectFromDatabase();

            expect(mockedMongooseDisconnect).not.toHaveBeenCalled();
        });
    });
});
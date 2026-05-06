import express, { Router } from "express";
import { vi, type Mocked } from "vitest";
import { PasswordUtils } from "../../src/utils/passwordUtils";
import { DecodedToken } from "../../src/interfaces/decodedToken";

export const defaultMockPayload = {
    uuid: "test-user-uuid",
    username: "testuser",
    id: "test-user-id",
};

export interface TestEnvironment {
    app: express.Application;
    mockUserService: ReturnType<typeof createMockUserService>;
    mockPasswordUtils: Mocked<typeof PasswordUtils>;
}

export const createTestApp = (router: Router, basePath: string, payload: object = defaultMockPayload) => {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
        req.payload = <DecodedToken>payload;
        next();
    });

    app.use(basePath, router);
    return app;
};

export const createMockUserService = () => ({
    getAllUsers: vi.fn(),
    getUserByUUID: vi.fn(),
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
    getUserByName: vi.fn(),
    existsUserByName: vi.fn(),
    createUser: vi.fn(),
    getUserAuthByName: vi.fn(),
    updateUserByUUID: vi.fn(),
    clearLastFmUsernameByUUID: vi.fn(),
});

export const setupTestEnvironment = (router: Router, basePath: string): TestEnvironment => {
    const mockUserService = createMockUserService();

    const mockPasswordUtils = vi.mocked(PasswordUtils);

    const app = createTestApp(router, basePath);

    return { app, mockUserService, mockPasswordUtils };
};

export const createMockWebSocketServer = () => ({
    broadcast: vi.fn(),
    sendMessageToUser: vi.fn(),
    getConnectedClients: vi.fn(),
});

export const createPublicTestApp = (router: Router, basePath: string) => {
    const app = express();
    app.use(express.json());
    app.use(basePath, router);
    return app;
};

export const createMockJwtAuthenticator = () => ({
    generateToken: vi.fn(),
    verifyToken: vi.fn(),
});

export const createMockLastFmApiService = () => ({
    getCurrentlyPlaying: vi.fn(),
    validateUsername: vi.fn(),
});

export const createMockOwmApiService = () => ({
    getCurrentlyPlaying: vi.fn(),
    validateUsername: vi.fn(),
})

export const createMockMusicPollingService = () => ({
    startPollingForUser: vi.fn(),
    stopPollingForUser: vi.fn(),
});

export const createMockS3Service = () => ({
    ensureBucketExists: vi.fn(),
    uploadFile: vi.fn(),
    listFilesForUser: vi.fn(),
    deleteFile: vi.fn(),
    getSignedDownloadUrl: vi.fn(),
    isFileDuplicate: vi.fn(),
});

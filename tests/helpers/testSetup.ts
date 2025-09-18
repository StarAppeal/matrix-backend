import express, { Router } from "express";
import { vi, type Mocked } from "vitest";
import { UserService } from "../../src/db/services/db/UserService";
import { PasswordUtils } from "../../src/utils/passwordUtils";

export const defaultMockPayload = {
    uuid: "test-user-uuid",
    username: "testuser",
    id: "test-user-id"
};

/**
 * Definiert die Struktur des zurückgegebenen Test-Environments für Typsicherheit.
 */
export interface TestEnvironment {
    app: express.Application;
    mockUserService: ReturnType<typeof createMockUserService>;
    mockPasswordUtils: Mocked<typeof PasswordUtils>;
}

/**
 * Erstellt eine Express-App für Testzwecke.
 * - Fügt JSON-Parsing-Middleware hinzu.
 * - Fügt eine Mock-Authentifizierungs-Middleware hinzu, die eine Payload an die Anfrage anhängt.
 * - Bindet den übergebenen Router an einen Basispfad.
 * @param router Der zu testende Express-Router.
 * @param basePath Der Basispfad, unter dem der Router erreichbar sein soll (z.B. "/user").
 * @param payload Die zu simulierende Benutzer-Payload. Standardmäßig wird defaultMockPayload verwendet.
 * @returns Eine konfigurierte Express-App-Instanz.
 */
export const createTestApp = (router: Router, basePath: string, payload: object = defaultMockPayload) => {
    const app = express();
    app.use(express.json());

    app.use((req: any, res, next) => {
        req.payload = payload;
        next();
    });

    app.use(basePath, router);
    return app;
};
/**
 * Erstellt ein Mock-Objekt für den UserService mit allen Methoden als vi.fn().
 * @returns Ein Mock-UserService-Objekt.
 */

export const createMockUserService = () => ({
    getAllUsers: vi.fn(),
    getUserByUUID: vi.fn(),
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
    getUserByName: vi.fn(),
    getSpotifyConfigByUUID: vi.fn(),
    clearSpotifyConfigByUUID: vi.fn(),
    existsUserByName: vi.fn(),
    createUser: vi.fn(),
    getUserAuthByName: vi.fn(),
});

/**
 * Initialisiert die gesamte Testumgebung für einen Controller-Test.
 * Erstellt Mocks, eine Test-App und verbindet alles miteinander.
 * @param router Der spezifische Router, der getestet werden soll.
 * @param basePath Der Basispfad für den Router (z.B. "/user").
 * @returns Ein Objekt mit der konfigurierten App und allen Mock-Instanzen.
 */
export const setupTestEnvironment = (router: Router, basePath: string): TestEnvironment => {
    const mockUserService = createMockUserService();
    vi.mocked(UserService.create).mockResolvedValue(mockUserService);

    const mockPasswordUtils = vi.mocked(PasswordUtils);

    const app = createTestApp(router, basePath);

    return { app, mockUserService, mockPasswordUtils };
};

/**
 * Erstellt ein Mock-Objekt für den ExtendedWebSocketServer.
 * @returns Ein Mock-WebSocketServer-Objekt.
 */
export const createMockWebSocketServer = () => ({
    broadcast: vi.fn(),
    sendMessageToUser: vi.fn(),
    getConnectedClients: vi.fn(),
});

/**
 * Erstellt eine "öffentliche" Express-App für Tests, ohne Mock-Authentifizierung.
 * Ideal für Login-, Register- oder andere öffentliche Routen.
 * @param router Der zu testende Router.
 * @param basePath Der Basispfad für den Router.
 * @returns Eine konfigurierte Express-App.
 */
export const createPublicTestApp = (router: Router, basePath: string) => {
    const app = express();
    app.use(express.json());
    app.use(basePath, router);
    return app;
};

/**
 * Erstellt ein Mock-Objekt für den JwtAuthenticator.
 */
export const createMockJwtAuthenticator = () => ({
    generateToken: vi.fn(),
    verifyToken: vi.fn(),
});

/**
 * Erstellt ein Mock-Objekt für den SpotifyTokenService.
 */
export const createMockSpotifyTokenService = () => ({
    refreshToken: vi.fn(),
    generateToken: vi.fn(),
});
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { RestLocation } from "../../src/rest/restLocation";
import { setupTestEnvironment, type TestEnvironment } from "../helpers/testSetup";

vi.mock("../../src/services/db/UserService", () => ({
    UserService: {
        create: vi.fn(),
        getUserByUUID: vi.fn()
    }
}));

vi.mock("../../src/utils/passwordUtils", () => ({
    PasswordUtils: {
        validatePassword: vi.fn(),
        hashPassword: vi.fn(),
        comparePassword: vi.fn()
    }
}));

vi.mock("../../src/services/owmApiService", () => ({
    validateLocation: vi.fn()
}));

import { validateLocation } from "../../src/services/owmApiService";

describe("RestLocation", () => {
    let testEnv: TestEnvironment;
    const mockedValidateLocation = vi.mocked(validateLocation);

    beforeEach(() => {
        vi.clearAllMocks();

        const restLocation = new RestLocation();
        testEnv = setupTestEnvironment(restLocation.createRouter(), "/location");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("GET /search", () => {
        const endpoint = "/location/search";

        it("should return list of locations for valid query", async () => {
            const query = "Berlin";
            const mockResult = [
                { name: "Berlin", country: "DE", lat: 52.5, lon: 13.4 }
            ];

            mockedValidateLocation.mockResolvedValue(mockResult as any);

            const response = await request(testEnv.app)
                .get(endpoint)
                .query({ q: query })
                .expect(200);

            expect(response.body.data.locations).toEqual(mockResult);
            expect(mockedValidateLocation).toHaveBeenCalledWith(query);
        });

        it("should return 400 if query 'q' is missing", async () => {
            const response = await request(testEnv.app)
                .get(endpoint)
                .expect(400);

            expect(response.body.details).toContain("q is required");
        });

        it("should return 400 if query 'q' is empty", async () => {
            const response = await request(testEnv.app)
                .get(endpoint)
                .query({ q: "" })
                .expect(400);

            expect(response.body.details).toContain("q must be a non-empty string");
        });

        it("should return empty list if service returns empty list (e.g. nothing found)", async () => {
            mockedValidateLocation.mockResolvedValue([]);

            const response = await request(testEnv.app)
                .get(endpoint)
                .query({ q: "GibtsNichtStadt" })
                .expect(200);

            expect(response.body.data.locations).toEqual([]);
        });
    });
});
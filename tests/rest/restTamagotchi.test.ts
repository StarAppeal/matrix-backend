import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { RestTamagotchi } from "../../src/rest/restTamagotchi";
import { TamagotchiService } from "../../src/services/db/tamagotchiService";
import { setupTestEnvironment, type TestEnvironment } from "../helpers/testSetup";
import { TamagotchiState } from "../../src/db/models/tamagotchi";

vi.mock("../../src/services/db/UserService", () => ({
    UserService: {
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

describe("RestTamagotchi", () => {
    let testEnv: TestEnvironment;
    let mockTamagotchiService: {
        getOrEvaluatePet: ReturnType<typeof vi.fn>;
        feed: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
        clean: ReturnType<typeof vi.fn>;
        sleep: ReturnType<typeof vi.fn>;
        isBusy: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockTamagotchiService = {
            getOrEvaluatePet: vi.fn(),
            feed: vi.fn(),
            play: vi.fn(),
            clean: vi.fn(),
            sleep: vi.fn(),
            isBusy: vi.fn(),
        };

        const restTamagotchi = new RestTamagotchi(mockTamagotchiService as unknown as TamagotchiService);
        testEnv = setupTestEnvironment(restTamagotchi.createRouter(), "/tamagotchi");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    const mockPayload = {
        hunger: 80,
        happiness: 80,
        hygiene: 100,
        energy: 100,
        status: TamagotchiState.IDLE_HAPPY,
    };

    describe("GET /", () => {
        it("should return tamagotchi payload", async () => {
            mockTamagotchiService.getOrEvaluatePet.mockResolvedValue(mockPayload as any);

            // We mock the static method because GET / calls TamagotchiService.toPayload
            vi.spyOn(TamagotchiService, "toPayload").mockReturnValue(mockPayload as any);

            const response = await request(testEnv.app)
                .get("/tamagotchi")
                .expect(200);

            expect(mockTamagotchiService.getOrEvaluatePet).toHaveBeenCalledWith("test-user-uuid");
            expect(response.body.data).toEqual(mockPayload);
        });
    });

    describe("POST /feed", () => {
        it("should return badRequest if busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(true);

            const response = await request(testEnv.app)
                .post("/tamagotchi/feed")
                .expect(400);

            expect(response.body.data.message).toBe("Pet is currently busy");
        });

        it("should feed pet if not busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(false);
            mockTamagotchiService.feed.mockResolvedValue(mockPayload);

            const response = await request(testEnv.app)
                .post("/tamagotchi/feed")
                .expect(200);

            expect(mockTamagotchiService.feed).toHaveBeenCalledWith("test-user-uuid");
            expect(response.body.data).toEqual(mockPayload);
        });
    });

    describe("POST /play", () => {
        it("should return badRequest if busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(true);

            const response = await request(testEnv.app)
                .post("/tamagotchi/play")
                .expect(400);

            expect(response.body.data.message).toBe("Pet is currently busy");
        });

        it("should play with pet if not busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(false);
            mockTamagotchiService.play.mockResolvedValue(mockPayload);

            const response = await request(testEnv.app)
                .post("/tamagotchi/play")
                .expect(200);

            expect(mockTamagotchiService.play).toHaveBeenCalledWith("test-user-uuid");
            expect(response.body.data).toEqual(mockPayload);
        });
    });

    describe("POST /clean", () => {
        it("should clean pet if not busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(false);
            mockTamagotchiService.clean.mockResolvedValue(mockPayload);

            const response = await request(testEnv.app)
                .post("/tamagotchi/clean")
                .expect(200);

            expect(mockTamagotchiService.clean).toHaveBeenCalledWith("test-user-uuid");
            expect(response.body.data).toEqual(mockPayload);
        });
    });

    describe("POST /sleep", () => {
        it("should sleep pet if not busy", async () => {
            mockTamagotchiService.isBusy.mockReturnValue(false);
            mockTamagotchiService.sleep.mockResolvedValue(mockPayload);

            const response = await request(testEnv.app)
                .post("/tamagotchi/sleep")
                .expect(200);

            expect(mockTamagotchiService.sleep).toHaveBeenCalledWith("test-user-uuid");
            expect(response.body.data).toEqual(mockPayload);
        });
    });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TamagotchiService } from "../../../src/services/db/tamagotchiService";
import { TamagotchiModel, TamagotchiState, TICK_INTERVAL_MS, DECAY_RATES } from "../../../src/db/models/tamagotchi";

vi.mock("../../../src/db/models/tamagotchi", async () => {
    const actual = await vi.importActual<any>("../../../src/db/models/tamagotchi");
    return {
        ...actual,
        TamagotchiModel: {
            findOne: vi.fn(),
            create: vi.fn(),
        },
    };
});

describe("TamagotchiService", () => {
    let tamagotchiService: TamagotchiService;

    beforeEach(() => {
        vi.clearAllMocks();
        tamagotchiService = new TamagotchiService();
    });

    const createMockPet = (overrides: Partial<any> = {}) => ({
        uuid: "test-uuid",
        hunger: 80,
        happiness: 80,
        hygiene: 100,
        energy: 100,
        status: TamagotchiState.IDLE_HAPPY,
        lastCalculatedAt: new Date(),
        save: vi.fn().mockResolvedValue(true),
        ...overrides,
    });

    it("should toPayload correctly", () => {
        const pet = createMockPet();
        const payload = TamagotchiService.toPayload(pet);
        expect(payload).toEqual({
            hunger: 80,
            happiness: 80,
            hygiene: 100,
            energy: 100,
            status: TamagotchiState.IDLE_HAPPY,
        });
    });

    describe("getOrEvaluatePet", () => {
        it("should create pet if not found", async () => {
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(null);
            const mockPet = createMockPet();
            vi.mocked(TamagotchiModel.create).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.getOrEvaluatePet("test-uuid");

            expect(TamagotchiModel.create).toHaveBeenCalledWith({ uuid: "test-uuid" });
            expect(pet).toBe(mockPet);
        });

        it("should apply missed ticks decay", async () => {
            const tenTicksAgo = new Date(Date.now() - 10 * TICK_INTERVAL_MS);
            const mockPet = createMockPet({ lastCalculatedAt: tenTicksAgo });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.getOrEvaluatePet("test-uuid");

            expect(pet.hunger).toBe(80 - 10 * DECAY_RATES.hunger);
            expect(pet.happiness).toBe(80 - 10 * DECAY_RATES.happiness);
            expect(pet.hygiene).toBe(100 - 10 * DECAY_RATES.hygiene);
            expect(pet.save).toHaveBeenCalled();
        });
    });

    describe("processTick", () => {
        it("should do nothing if dead", async () => {
            const mockPet = createMockPet({ status: TamagotchiState.DEAD });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.processTick("test-uuid");

            expect(pet?.hunger).toBe(80);
            expect(mockPet.save).not.toHaveBeenCalled();
        });

        it("should decay values", async () => {
            const mockPet = createMockPet();
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.processTick("test-uuid");

            expect(pet?.hunger).toBe(80 - DECAY_RATES.hunger);
            expect(pet?.happiness).toBe(80 - DECAY_RATES.happiness);
            expect(pet?.hygiene).toBe(100 - DECAY_RATES.hygiene);
            expect(mockPet.save).toHaveBeenCalled();
        });
    });

    describe("feed", () => {
        it("should increase hunger and set state to EATING", async () => {
            const mockPet = createMockPet({ hunger: 50 });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.feed("test-uuid");

            expect(pet?.hunger).toBe(80);
            expect(pet?.status).toBe(TamagotchiState.EATING);
            expect(mockPet.save).toHaveBeenCalled();
        });

        it("should not exceed 100 hunger", async () => {
            const mockPet = createMockPet({ hunger: 90 });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.feed("test-uuid");

            expect(pet?.hunger).toBe(100);
        });
    });

    describe("evaluateStatus", () => {
        it("should die if hunger and happiness are 0", () => {
            const pet = createMockPet({ hunger: 0, happiness: 0 });
            tamagotchiService.evaluateStatus(pet);
            expect(pet.status).toBe(TamagotchiState.DEAD);
        });

        it("should be sick if hunger < 30", () => {
            const pet = createMockPet({ hunger: 20 });
            tamagotchiService.evaluateStatus(pet);
            expect(pet.status).toBe(TamagotchiState.IDLE_SICK);
        });

        it("should be sick if hygiene < 30", () => {
            const pet = createMockPet({ hygiene: 20 });
            tamagotchiService.evaluateStatus(pet);
            expect(pet.status).toBe(TamagotchiState.IDLE_SICK);
        });
    });
});

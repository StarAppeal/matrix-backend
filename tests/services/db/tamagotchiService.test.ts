import { describe, it, expect, vi, beforeEach } from "vitest";
import { TamagotchiService } from "../../../src/services/db/tamagotchiService";
import {
    AWAKE_DECAY_RATES,
    SLEEPING_DECAY_RATES,
    TamagotchiModel,
    TamagotchiState,
    TICK_INTERVAL_MS,
} from "../../../src/db/models/tamagotchi";
import { appEventBus } from "../../../src/utils/eventBus";

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
        vi.useFakeTimers();
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
        const payload = TamagotchiService.toPayload(pet as any);
        expect(payload).toEqual({
            hunger: 80,
            happiness: 80,
            hygiene: 100,
            energy: 100,
            status: TamagotchiState.IDLE_HAPPY,
            visuals: {
                dirt_intensity: 0,
                has_glasses: false,
                stink_intensity: 0,
            },
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

        it("should apply missed ticks decay when awake", async () => {
            const tenTicksAgo = new Date(Date.now() - 10 * TICK_INTERVAL_MS);
            const mockPet = createMockPet({ lastCalculatedAt: tenTicksAgo });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.getOrEvaluatePet("test-uuid");

            expect(pet.hunger).toBe(80 - 10 * AWAKE_DECAY_RATES.hunger);
            expect(pet.happiness).toBe(80 - 10 * AWAKE_DECAY_RATES.happiness);
            expect(pet.hygiene).toBe(100 - 10 * AWAKE_DECAY_RATES.hygiene);
            expect(pet.save).toHaveBeenCalled();
        });

        it("should apply missed ticks decay when asleep", async () => {
            const tenTicksAgo = new Date(Date.now() - 10 * TICK_INTERVAL_MS);
            const mockPet = createMockPet({ lastCalculatedAt: tenTicksAgo, status: TamagotchiState.SLEEPING });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.getOrEvaluatePet("test-uuid");

            expect(pet.hunger).toBe(80 - 10 * SLEEPING_DECAY_RATES.hunger);
            expect(pet.happiness).toBe(80 - 10 * SLEEPING_DECAY_RATES.happiness);
            expect(pet.hygiene).toBe(100 - 10 * SLEEPING_DECAY_RATES.hygiene);
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

        it("should decay values awake", async () => {
            const mockPet = createMockPet();
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.processTick("test-uuid");

            expect(pet?.hunger).toBe(80 - AWAKE_DECAY_RATES.hunger);
            expect(pet?.happiness).toBe(80 - AWAKE_DECAY_RATES.happiness);
            expect(pet?.hygiene).toBe(100 - AWAKE_DECAY_RATES.hygiene);
            expect(mockPet.save).toHaveBeenCalled();
        });

        it("should decay values when asleep", async () => {
            const mockPet = createMockPet({ status: TamagotchiState.SLEEPING });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.processTick("test-uuid");

            expect(pet?.hunger).toBe(80 - SLEEPING_DECAY_RATES.hunger);
            expect(pet?.happiness).toBe(80 - SLEEPING_DECAY_RATES.happiness);
            expect(pet?.hygiene).toBe(100 - SLEEPING_DECAY_RATES.hygiene);
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

    describe("clean", () => {
        it("should increase hygiene and happiness and set state to CLEANING", async () => {
            const mockPet = createMockPet({ hygiene: 50, happiness: 50 });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.clean("test-uuid");

            expect(pet?.hygiene).toBe(80);
            expect(pet?.happiness).toBe(60);
            expect(pet?.status).toBe(TamagotchiState.CLEANING);
            expect(mockPet.save).toHaveBeenCalled();
        });
    });

    describe("sleep", () => {
        it("should set state to SLEEPING if awake", async () => {
            const mockPet = createMockPet({ status: TamagotchiState.IDLE_HAPPY });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const pet = await tamagotchiService.sleep("test-uuid");

            expect(pet?.status).toBe(TamagotchiState.SLEEPING);
            expect(mockPet.save).toHaveBeenCalled();
        });
    });

    describe("awake", () => {
        it("should set state to AWAKING immediately and resolve to real state after 4 seconds", async () => {
            const mockPet = createMockPet({ status: TamagotchiState.SLEEPING });
            vi.mocked(TamagotchiModel.findOne).mockResolvedValue(mockPet as any);

            const emitSpy = vi.spyOn(appEventBus, "emit");
            const pet = await tamagotchiService.awake("test-uuid");

            expect(pet?.status).toBe(TamagotchiState.AWAKING);

            expect(mockPet.status).toBe(TamagotchiState.IDLE_HAPPY);
            expect(mockPet.save).toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(4000);

            const lastEmitCall = emitSpy.mock.calls[emitSpy.mock.calls.length - 1];
            const emittedData = lastEmitCall[1];

            expect(emittedData.payload.status).toBe(TamagotchiState.IDLE_HAPPY);
        });
    });

    describe("evaluateStatus", () => {
        it("should die if hunger and happiness are 0", () => {
            const pet = createMockPet({ hunger: 0, happiness: 0 });
            tamagotchiService.evaluateStatus(pet as any);
            expect(pet.status).toBe(TamagotchiState.DEAD);
        });

        it("should be sick if hunger < 30", () => {
            const pet = createMockPet({ hunger: 20 });
            tamagotchiService.evaluateStatus(pet as any);
            expect(pet.status).toBe(TamagotchiState.IDLE_SAD);
        });

        it("should be sick if hygiene < 30", () => {
            const pet = createMockPet({ hygiene: 20 });
            tamagotchiService.evaluateStatus(pet as any);
            expect(pet.status).toBe(TamagotchiState.IDLE_SAD);
        });

        it("should preserve SLEEPING state unless dead", () => {
            const pet = createMockPet({ status: TamagotchiState.SLEEPING, hunger: 20 });
            tamagotchiService.evaluateStatus(pet as any);
            expect(pet.status).toBe(TamagotchiState.SLEEPING);
        });
    });
});

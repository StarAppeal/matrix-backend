import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from "vitest";
import { TamagotchiPollingService } from "../../src/services/tamagotchiPollingService";
import { TamagotchiService } from "../../src/services/db/tamagotchiService";
import { appEventBus, TAMAGOTCHI_STATE_UPDATED_EVENT } from "../../src/utils/eventBus";
import { TamagotchiState, TICK_INTERVAL_MS } from "../../src/db/models/tamagotchi";

vi.mock("../../src/utils/eventBus", () => ({
    appEventBus: {
        emit: vi.fn(),
    },
    TAMAGOTCHI_STATE_UPDATED_EVENT: "TAMAGOTCHI_STATE_UPDATED_EVENT",
}));

describe("TamagotchiPollingService", () => {
    let tamagotchiPollingService: TamagotchiPollingService;
    let mockTamagotchiService: Mocked<TamagotchiService>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        mockTamagotchiService = {
            getOrEvaluatePet: vi.fn(),
            processTick: vi.fn(),
            feed: vi.fn(),
            evaluateStatus: vi.fn(),
        } as unknown as Mocked<TamagotchiService>;
        
        TamagotchiService.toPayload = vi.fn().mockReturnValue({
            hunger: 80,
            happiness: 80,
            hygiene: 100,
            energy: 100,
            status: TamagotchiState.IDLE_HAPPY,
        });

        tamagotchiPollingService = new TamagotchiPollingService(mockTamagotchiService);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should start polling and emit initial update", async () => {
        const mockPet = { uuid: "test-uuid" } as any;
        mockTamagotchiService.getOrEvaluatePet.mockResolvedValue(mockPet);

        await tamagotchiPollingService.startPollingForUser("test-uuid");

        expect(mockTamagotchiService.getOrEvaluatePet).toHaveBeenCalledWith("test-uuid");
        expect(appEventBus.emit).toHaveBeenCalledWith(TAMAGOTCHI_STATE_UPDATED_EVENT, {
            uuid: "test-uuid",
            payload: expect.any(Object)
        });
    });

    it("should tick on interval", async () => {
        const mockPet = { uuid: "test-uuid" } as any;
        mockTamagotchiService.getOrEvaluatePet.mockResolvedValue(mockPet);
        mockTamagotchiService.processTick.mockResolvedValue(mockPet);

        await tamagotchiPollingService.startPollingForUser("test-uuid");
        
        await vi.advanceTimersByTimeAsync(TICK_INTERVAL_MS);

        expect(mockTamagotchiService.processTick).toHaveBeenCalledWith("test-uuid");
        
        // Initial emit + 1 tick emit
        expect(appEventBus.emit).toHaveBeenCalledTimes(2);
    });

    it("should stop polling", async () => {
        const mockPet = { uuid: "test-uuid" } as any;
        mockTamagotchiService.getOrEvaluatePet.mockResolvedValue(mockPet);

        await tamagotchiPollingService.startPollingForUser("test-uuid");
        
        tamagotchiPollingService.stopPollingForUser("test-uuid");
        vi.advanceTimersByTime(TICK_INTERVAL_MS);

        expect(mockTamagotchiService.processTick).not.toHaveBeenCalled();
    });
});

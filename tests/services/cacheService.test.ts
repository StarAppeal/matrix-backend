import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CacheService } from "../../src/services/cacheService";

describe("CacheService", () => {
    let cacheService: CacheService;

    beforeEach(() => {
        vi.useFakeTimers();
        cacheService = new CacheService();
    });

    afterEach(() => {
        cacheService.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("should compute and return a value when not cached", async () => {
        const computeFn = vi.fn().mockResolvedValue("computed_value");

        const result = await cacheService.getOrSet("test_key", 1000, computeFn);

        expect(result).toBe("computed_value");
        expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it("should return cached value and not recompute if within TTL", async () => {
        const computeFn = vi.fn().mockResolvedValue("computed_value");

        await cacheService.getOrSet("test_key", 1000, computeFn);
        const result = await cacheService.getOrSet("test_key", 1000, computeFn);

        expect(result).toBe("computed_value");
        expect(computeFn).toHaveBeenCalledTimes(1);
    });

    it("should recompute if cache is expired", async () => {
        const computeFn = vi.fn().mockResolvedValue("computed_value");

        await cacheService.getOrSet("test_key", 1000, computeFn);

        vi.advanceTimersByTime(1001);

        const result = await cacheService.getOrSet("test_key", 1000, computeFn);

        expect(result).toBe("computed_value");
        expect(computeFn).toHaveBeenCalledTimes(2);
    });

    it("should prevent duplicate computations for concurrent requests", async () => {
        let resolveComputation: (val: string) => void;
        const slowComputeFn = vi.fn().mockImplementation(() => {
            return new Promise((resolve) => {
                resolveComputation = resolve;
            });
        });

        const promise1 = cacheService.getOrSet("slow_key", 1000, slowComputeFn);
        const promise2 = cacheService.getOrSet("slow_key", 1000, slowComputeFn);
        const promise3 = cacheService.getOrSet("slow_key", 1000, slowComputeFn);

        expect(slowComputeFn).toHaveBeenCalledTimes(1);

        resolveComputation!("computed_slow_value");

        await vi.runAllTicks();

        const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);

        expect(res1).toBe("computed_slow_value");
        expect(res2).toBe("computed_slow_value");
        expect(res3).toBe("computed_slow_value");

        const result4 = await cacheService.getOrSet("slow_key", 1000, slowComputeFn);
        expect(result4).toBe("computed_slow_value");
        expect(slowComputeFn).toHaveBeenCalledTimes(1);
    });

    it("should remove in-flight promise if computation fails", async () => {
        const computeFnError = vi.fn().mockRejectedValue(new Error("Compute failed"));

        await expect(cacheService.getOrSet("error_key", 1000, computeFnError)).rejects.toThrow("Compute failed");

        const computeFnSuccess = vi.fn().mockResolvedValue("success");
        const result = await cacheService.getOrSet("error_key", 1000, computeFnSuccess);

        expect(result).toBe("success");
        expect(computeFnSuccess).toHaveBeenCalledTimes(1);
    });

    it("should be able to clear cache manually", async () => {
        const computeFn = vi.fn().mockResolvedValue("computed_value");

        await cacheService.getOrSet("test_key", 1000, computeFn);

        cacheService.clear("test_key");

        await cacheService.getOrSet("test_key", 1000, computeFn);

        expect(computeFn).toHaveBeenCalledTimes(2);
    });

    it("should periodically clean up expired cache entries", async () => {
        const computeFn = vi.fn().mockResolvedValue("computed_value");

        await cacheService.getOrSet("expiring_key", 1000, computeFn);

        expect((cacheService as any).cache.size).toBe(1);

        await vi.advanceTimersByTimeAsync(65000);

        expect((cacheService as any).cache.size).toBe(0);
    });
});

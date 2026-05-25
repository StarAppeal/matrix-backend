export class CacheService {
    private cache = new Map<string, { value: unknown; expiresAt: number }>();
    private inFlight = new Map<string, Promise<unknown>>();
    private readonly cleanupInterval?: NodeJS.Timeout;

    constructor(cleanupIntervalMs = 60000) {
        if (cleanupIntervalMs > 0) {
            this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
            if (this.cleanupInterval.unref) {
                this.cleanupInterval.unref();
            }
        }
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now >= item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    async getOrSet<T>(key: string, ttlMs: number, computeFn: () => Promise<T>): Promise<T> {
        const cached = this.cache.get(key);
        if (cached) {
            if (Date.now() < cached.expiresAt) {
                return cached.value as T;
            } else {
                this.cache.delete(key);
            }
        }

        const existingPromise = this.inFlight.get(key);
        if (existingPromise) {
            return existingPromise as Promise<T>;
        }

        const promise = computeFn()
            .then((result) => {
                this.cache.set(key, { value: result, expiresAt: Date.now() + ttlMs });
                this.inFlight.delete(key);
                return result;
            })
            .catch((err) => {
                this.inFlight.delete(key);
                throw err;
            });

        this.inFlight.set(key, promise);
        return promise;
    }

    clear(key?: string): void {
        if (key) {
            this.cache.delete(key);
            this.inFlight.delete(key);
        } else {
            this.cache.clear();
            this.inFlight.clear();
        }
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

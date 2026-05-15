import { S3Service } from "../../src/services/s3Service";
import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { StateUtils } from "../../src/utils/stateUtils";
import { MatrixState } from "../../src/db/models/user";

describe("WebsocketClientService", () => {
    let mockS3Service: Mocked<S3Service>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockS3Service = {
            getSignedDownloadUrl: vi.fn(),
        } as unknown as Mocked<S3Service>;
    });

    describe("hydrate", () => {
        it("should return DEFAULT_STATE if user has no lastState", async () => {
            const stateUtils = new StateUtils(null as any);

            const state = await stateUtils.hydrate(mockS3Service);

            expect(state).toEqual({ global: { mode: "idle", brightness: 100 } });
            expect(mockS3Service.getSignedDownloadUrl).not.toHaveBeenCalled();
        });

        it("should return the state unchanged if mode is not image", async () => {
            const stateUtils = new StateUtils({ global: { mode: "music", brightness: 100 } } as MatrixState);

            const state = await stateUtils.hydrate(mockS3Service);

            expect(state).toEqual({ global: { mode: "music", brightness: 100 } });
            expect(mockS3Service.getSignedDownloadUrl).not.toHaveBeenCalled();
        });

        it("should hydrate the state with S3 URL if mode is image and s3_key exists", async () => {
            const stateUtils = new StateUtils({
                global: { mode: "image", brightness: 100 },
                image: { s3_key: "users/user-123/img.gif" },
            } as MatrixState);

            mockS3Service.getSignedDownloadUrl.mockResolvedValue("https://s3.example.com/presigned-url");

            const state = (await stateUtils.hydrate(mockS3Service)) as any;

            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalledWith("users/user-123/img.gif", 60);
            expect(state.image.image_url).toBe("https://s3.example.com/presigned-url");
        });

        it("should gracefully handle S3 errors and return state without crashing", async () => {
            const stateUtils = new StateUtils({
                global: { mode: "image", brightness: 100 },
                image: { s3_key: "users/user-123/broken.gif" },
            } as MatrixState);

            mockS3Service.getSignedDownloadUrl.mockRejectedValue(new Error("S3 Timeout"));

            const state = (await stateUtils.hydrate(mockS3Service)) as any;

            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalled();
            expect(state.image.image_url).toBeUndefined();
            expect(state.image.s3_key).toBe("users/user-123/broken.gif");
        });

        it("should deep clone the state to avoid Mongoose side effects", async () => {
            const originalState = { global: { mode: "music", brightness: 100 } } as MatrixState;
            const stateUtils = new StateUtils(originalState);

            const state = await stateUtils.hydrate(mockS3Service);

            state.global.mode = "image";

            expect(originalState.global.mode).toBe("music");
            expect(state.global.mode).toBe("image");
        });
    });
});

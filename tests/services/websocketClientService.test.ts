import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { WebSocket } from "ws";
import { ExtendedWebSocket } from "../../src/interfaces/extendedWebsocket";
import { S3Service } from "../../src/services/s3Service";
import { WebsocketClientService } from "../../src/services/websocketClientService";
import { WebsocketOutboundType } from "../../src/utils/websocket/websocketCustomEvents/websocketOutboundType";

vi.mock("../../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("WebsocketClientService", () => {
    let mockClient: Mocked<ExtendedWebSocket>;
    let mockS3Service: Mocked<S3Service>;
    let service: WebsocketClientService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            readyState: WebSocket.OPEN,
            send: vi.fn(),
            user: {
                uuid: "user-123",
                timezone: "Europe/Berlin",
                lastState: undefined,
            },
        } as unknown as Mocked<ExtendedWebSocket>;

        mockS3Service = {
            getSignedDownloadUrl: vi.fn(),
        } as unknown as Mocked<S3Service>;

        service = new WebsocketClientService(mockClient);
    });

    describe("updateUser", () => {
        it("should update the user object on the client", () => {
            const newUser = { uuid: "user-123", timezone: "America/New_York" } as any;
            service.updateUser(newUser);
            expect(mockClient.user).toEqual(newUser);
        });
    });

    describe("sendPayload", () => {
        it("should format and send the payload if socket is OPEN", () => {
            service.sendPayload(WebsocketOutboundType.STATE, { mode: "idle" });

            expect(mockClient.send).toHaveBeenCalledOnce();
            expect(mockClient.send).toHaveBeenCalledWith(
                JSON.stringify({ type: WebsocketOutboundType.STATE, payload: { mode: "idle" } }),
                { binary: false }
            );
        });

        it("should NOT send the payload if socket is NOT OPEN", () => {
            (mockClient as any).readyState = WebSocket.CLOSED;

            service.sendPayload(WebsocketOutboundType.STATE, { mode: "idle" });

            expect(mockClient.send).not.toHaveBeenCalled();
        });
    });

    describe("getSettings", () => {
        it("should return the user's timezone", () => {
            const settings = service.getSettings();
            expect(settings).toEqual({ timezone: "Europe/Berlin" });
        });
    });

    describe("getHydratedState", () => {
        it("should return DEFAULT_STATE if user has no lastState", async () => {
            mockClient.user.lastState = undefined;

            const state = await service.getHydratedState(mockS3Service);

            expect(state).toEqual({ global: { mode: "idle", brightness: 100 } });
            expect(mockS3Service.getSignedDownloadUrl).not.toHaveBeenCalled();
        });

        it("should return the state unchanged if mode is not image", async () => {
            mockClient.user.lastState = { global: { mode: "music", brightness: 100 } } as any;

            const state = await service.getHydratedState(mockS3Service);

            expect(state).toEqual({ global: { mode: "music", brightness: 100 } });
            expect(mockS3Service.getSignedDownloadUrl).not.toHaveBeenCalled();
        });

        it("should hydrate the state with S3 URL if mode is image and s3_key exists", async () => {
            mockClient.user.lastState = {
                global: { mode: "image", brightness: 100 },
                image: { s3_key: "users/user-123/img.gif" },
            } as any;
            mockS3Service.getSignedDownloadUrl.mockResolvedValue("https://s3.example.com/presigned-url");

            const state = await service.getHydratedState(mockS3Service) as any;

            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalledWith("users/user-123/img.gif", 60);
            expect(state.image.image_url).toBe("https://s3.example.com/presigned-url");
        });

        it("should gracefully handle S3 errors and return state without crashing", async () => {
            mockClient.user.lastState = {
                global: { mode: "image", brightness: 100 },
                image: { s3_key: "users/user-123/broken.gif" },
            } as any;

            mockS3Service.getSignedDownloadUrl.mockRejectedValue(new Error("S3 Timeout"));

            const state = await service.getHydratedState(mockS3Service) as any;

            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalled();
            expect(state.image.image_url).toBeUndefined();
            expect(state.image.s3_key).toBe("users/user-123/broken.gif");
        });

        it("should deep clone the state to avoid Mongoose side effects", async () => {
            const originalState = { global: { mode: "music", brightness: 100 } } as any;
            mockClient.user.lastState = originalState;

            const state = await service.getHydratedState(mockS3Service);

            state.global.mode = "image";

            expect(originalState.global.mode).toBe("music");
            expect(state.global.mode).toBe("image");
        });
    });
});

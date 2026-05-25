import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { appEventBus, COMMAND_SEND_STATE } from "../../../src/utils/eventBus";
import { MatrixStateEventListener } from "../../../src/websocket/listeners/matrixStateEventListener";
import { ExtendedWebSocketServer } from "../../../src/websocket";
import { S3Service } from "../../../src/services/s3Service";
import { ImageServiceFactory, TargetMode } from "../../../src/services/imageService";

const eventBusListeners = new Map<string, (...args: any[]) => void>();

vi.mock("../../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn((event, listener) => {
            eventBusListeners.set(event, listener);
        }),
        emit: vi.fn(),
    },
    COMMAND_SEND_STATE: "command:send-state",
}));

describe("MatrixStateEventListener", () => {
    let mockWss: Mocked<ExtendedWebSocketServer>;
    let mockS3Service: Mocked<S3Service>;
    let mockImageServiceFactory: Mocked<ImageServiceFactory>;
    let mockImageService: any;
    let listener: MatrixStateEventListener;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBusListeners.clear();

        mockWss = {
            sendPayload: vi.fn(),
            sendBinary: vi.fn(),
        } as unknown as Mocked<ExtendedWebSocketServer>;

        mockS3Service = {
            downloadToBuffer: vi.fn(),
        } as unknown as Mocked<S3Service>;

        mockImageService = {
            toMatrixBinaryFrame: vi.fn(),
        };

        mockImageServiceFactory = {
            fromBuffer: vi.fn().mockReturnValue(mockImageService),
        } as unknown as Mocked<ImageServiceFactory>;

        listener = new MatrixStateEventListener(mockWss, mockS3Service, mockImageServiceFactory);
    });

    it("should register COMMAND_SEND_STATE listener on init", () => {
        expect(appEventBus.on).toHaveBeenCalledWith(COMMAND_SEND_STATE, expect.any(Function));
    });

    it("should send JSON state payload and do nothing more if user not connected", async () => {
        mockWss.sendPayload.mockReturnValue(false);
        const stateHandler = eventBusListeners.get(COMMAND_SEND_STATE);
        expect(stateHandler).toBeDefined();

        await stateHandler!({ uuid: "user-1", state: { global: { mode: "idle" } } });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "STATE", { global: { mode: "idle" } });
        expect(mockS3Service.downloadToBuffer).not.toHaveBeenCalled();
        expect(mockWss.sendBinary).not.toHaveBeenCalled();
    });

    it("should send JSON payload but not fetch S3 if mode is not image", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const stateHandler = eventBusListeners.get(COMMAND_SEND_STATE);

        await stateHandler!({ uuid: "user-1", state: { global: { mode: "music" } } });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "STATE", { global: { mode: "music" } });
        expect(mockS3Service.downloadToBuffer).not.toHaveBeenCalled();
    });

    it("should fetch S3, convert to binary, and send if mode is image and no oldState is provided", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const fakeBuffer = Buffer.from("fake-img");
        mockS3Service.downloadToBuffer.mockResolvedValue(fakeBuffer);
        const fakeBinary = Buffer.from([9, 9, 9]);
        mockImageService.toMatrixBinaryFrame.mockResolvedValue(fakeBinary);

        const stateHandler = eventBusListeners.get(COMMAND_SEND_STATE);
        const statePayload = {
            global: { mode: "image" },
            image: { s3_key: "my-key.png", fit: "contain" },
        };

        await stateHandler!({ uuid: "user-1", state: statePayload });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "STATE", statePayload);
        expect(mockS3Service.downloadToBuffer).toHaveBeenCalledWith("my-key.png");
        expect(mockImageServiceFactory.fromBuffer).toHaveBeenCalledWith(fakeBuffer, "my-key.png");
        expect(mockImageService.toMatrixBinaryFrame).toHaveBeenCalledWith(TargetMode.ImageMode, 64, 64, "contain");
        expect(mockWss.sendBinary).toHaveBeenCalledWith("user-1", fakeBinary);
    });

    it("should skip S3 fetch if oldState settings match newState settings", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const stateHandler = eventBusListeners.get(COMMAND_SEND_STATE);

        const statePayload = {
            global: { mode: "image" },
            image: { s3_key: "my-key.png", fit: "contain" },
        };

        await stateHandler!({
            uuid: "user-1",
            state: statePayload,
            oldState: statePayload,
        });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "STATE", statePayload);
        expect(mockS3Service.downloadToBuffer).not.toHaveBeenCalled();
        expect(mockWss.sendBinary).not.toHaveBeenCalled();
    });

    it("should NOT skip S3 fetch if oldState settings do not match newState settings", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const fakeBuffer = Buffer.from("fake-img");
        mockS3Service.downloadToBuffer.mockResolvedValue(fakeBuffer);
        const fakeBinary = Buffer.from([9, 9, 9]);
        mockImageService.toMatrixBinaryFrame.mockResolvedValue(fakeBinary);

        const stateHandler = eventBusListeners.get(COMMAND_SEND_STATE);

        const oldState = {
            global: { mode: "image" },
            image: { s3_key: "old-key.png", fit: "contain" },
        };
        const newState = {
            global: { mode: "image" },
            image: { s3_key: "new-key.png", fit: "contain" },
        };

        await stateHandler!({
            uuid: "user-1",
            state: newState,
            oldState: oldState,
        });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "STATE", newState);
        expect(mockS3Service.downloadToBuffer).toHaveBeenCalledWith("new-key.png");
        expect(mockWss.sendBinary).toHaveBeenCalledWith("user-1", fakeBinary);
    });
});

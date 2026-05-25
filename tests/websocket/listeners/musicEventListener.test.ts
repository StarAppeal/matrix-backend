import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { appEventBus, MUSIC_STATE_UPDATED_EVENT } from "../../../src/utils/eventBus";
import { MusicEventListener } from "../../../src/websocket/listeners/musicEventListener";
import { ExtendedWebSocketServer } from "../../../src/websocket";
import { ImageServiceFactory, TargetMode } from "../../../src/services/imageService";

const eventBusListeners = new Map<string, (...args: any[]) => void>();

vi.mock("../../../src/utils/eventBus", () => ({
    appEventBus: {
        on: vi.fn((event, listener) => {
            eventBusListeners.set(event, listener);
        }),
        emit: vi.fn(),
    },
    MUSIC_STATE_UPDATED_EVENT: "music:updated",
}));

describe("MusicEventListener", () => {
    let mockWss: Mocked<ExtendedWebSocketServer>;
    let mockImageServiceFactory: Mocked<ImageServiceFactory>;
    let mockImageService: any;
    let listener: MusicEventListener;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBusListeners.clear();

        mockWss = {
            sendPayload: vi.fn(),
            sendBinary: vi.fn(),
        } as unknown as Mocked<ExtendedWebSocketServer>;

        mockImageService = {
            toMatrixBinaryFrame: vi.fn(),
        };

        mockImageServiceFactory = {
            fromUrl: vi.fn().mockResolvedValue(mockImageService),
        } as unknown as Mocked<ImageServiceFactory>;

        listener = new MusicEventListener(mockWss, mockImageServiceFactory);
    });

    it("should register MUSIC_STATE_UPDATED_EVENT listener on init", () => {
        expect(appEventBus.on).toHaveBeenCalledWith(MUSIC_STATE_UPDATED_EVENT, expect.any(Function));
    });

    it("should send JSON payload and do nothing more if user not connected", async () => {
        mockWss.sendPayload.mockReturnValue(false);
        const musicHandler = eventBusListeners.get(MUSIC_STATE_UPDATED_EVENT);
        expect(musicHandler).toBeDefined();

        const fakeState = { isPlaying: true, title: "Song", artist: "Artist", imageUrl: "http://cover.jpg" };
        await musicHandler!({ uuid: "user-1", state: fakeState });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "MUSIC_UPDATE", fakeState);
        expect(mockImageServiceFactory.fromUrl).not.toHaveBeenCalled();
    });

    it("should send JSON payload and do nothing more if there is no imageUrl", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const musicHandler = eventBusListeners.get(MUSIC_STATE_UPDATED_EVENT);

        const fakeState = { isPlaying: false, title: "Song", artist: "Artist" };
        await musicHandler!({ uuid: "user-1", state: fakeState });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "MUSIC_UPDATE", fakeState);
        expect(mockImageServiceFactory.fromUrl).not.toHaveBeenCalled();
    });

    it("should fetch cover image, convert to binary, and send if user connected and has imageUrl", async () => {
        mockWss.sendPayload.mockReturnValue(true);
        const fakeBinary = Buffer.from([1, 2, 3]);
        mockImageService.toMatrixBinaryFrame.mockResolvedValue(fakeBinary);

        const musicHandler = eventBusListeners.get(MUSIC_STATE_UPDATED_EVENT);
        const fakeState = { isPlaying: true, title: "Song", artist: "Artist", imageUrl: "http://cover.jpg" };

        await musicHandler!({ uuid: "user-1", state: fakeState });

        expect(mockWss.sendPayload).toHaveBeenCalledWith("user-1", "MUSIC_UPDATE", fakeState);
        expect(mockImageServiceFactory.fromUrl).toHaveBeenCalledWith("http://cover.jpg");
        expect(mockImageService.toMatrixBinaryFrame).toHaveBeenCalledWith(TargetMode.MusicMode, 64, 64);
        expect(mockWss.sendBinary).toHaveBeenCalledWith("user-1", fakeBinary);
    });
});

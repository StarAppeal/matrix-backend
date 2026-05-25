import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPngBuffer = Buffer.from([0xaa, 0xbb, 0xcc]);

vi.mock("sharp", () => ({
    default: vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        png: vi.fn().mockReturnThis(),
        gif: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockPngBuffer),
    })),
}));

import sharp from "sharp";
import { ImageService, PayloadType, TargetMode } from "../../src/services/imageService";

const mockSharp = vi.mocked(sharp);

describe("ImageService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should build a compressed PNG frame for non-GIF inputs", async () => {
        const input = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const service = new ImageService(input);

        const result = await service.toMatrixBinaryFrame(TargetMode.ImageMode, 16, 8);

        const instance = mockSharp.mock.results[0].value;
        expect(mockSharp).toHaveBeenCalledWith(input);
        expect(instance.resize).toHaveBeenCalledWith(16, 8, { fit: "contain" });
        expect(instance.png).toHaveBeenCalledWith({ palette: true, quality: 80 });
        expect(result.subarray(0, 4)).toEqual(
            Buffer.from([0, 0, 0, mockPngBuffer.length])
        );
        expect(result.subarray(4, 8)).toEqual(
            Buffer.from([TargetMode.ImageMode, PayloadType.COMPRESSED_IMAGE, 16, 8])
        );
        expect(result.subarray(8)).toEqual(mockPngBuffer);
    });

    it("should build a compressed GIF frame for GIF inputs", async () => {
        const input = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
        const service = new ImageService(input);

        const result = await service.toMatrixBinaryFrame(TargetMode.MusicMode, 32, 16);

        const instance = mockSharp.mock.results[0].value;
        expect(mockSharp).toHaveBeenCalledWith(input, { pages: -1 });
        expect(instance.resize).toHaveBeenCalledWith(32, 16, { fit: "contain" });
        expect(instance.gif).toHaveBeenCalledOnce();
        expect(result.subarray(0, 4)).toEqual(
            Buffer.from([0, 0, 0, mockPngBuffer.length])
        );
        expect(result.subarray(4, 8)).toEqual(
            Buffer.from([TargetMode.MusicMode, PayloadType.COMPRESSED_GIF, 32, 16])
        );
    });

    it("should call toBuffer for compressed output", async () => {
        const input = Buffer.from([0x42, 0x4d, 0x00, 0x00]);
        const service = new ImageService(input);

        await service.toMatrixBinaryFrame(TargetMode.ImageMode, 5, 6);

        const instance = mockSharp.mock.results[0].value;
        expect(instance.toBuffer).toHaveBeenCalledOnce();
    });
});

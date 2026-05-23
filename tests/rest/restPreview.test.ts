import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("dns/promises", () => ({
    lookup: vi.fn(),
}));

import { lookup } from "dns/promises";

const mockLookup = vi.mocked(lookup);

import { RestPreview } from "../../src/rest/restPreview";
import { TargetMode } from "../../src/services/imageService";
import { createPublicTestApp } from "../helpers/testSetup";
import type { S3Service } from "../../src/services/s3Service";
import type { ImageServiceFactory } from "../../src/services/imageService";

const parseBinary = (res: any, cb: (err: Error | null, body?: Buffer) => void) => {
    const data: Buffer[] = [];
    res.on("data", (chunk: Buffer) => data.push(chunk));
    res.on("end", () => cb(null, Buffer.concat(data)));
};

describe("RestPreview", () => {
    let app: ReturnType<typeof createPublicTestApp>;
    let mockS3Service: { downloadToBuffer: ReturnType<typeof vi.fn> };
    let mockImageService: { toMatrixBinaryFrame: ReturnType<typeof vi.fn> };
    let mockImageServiceFactory: {
        fromBuffer: ReturnType<typeof vi.fn>;
        fromUrl: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockS3Service = {
            downloadToBuffer: vi.fn(),
        };

        mockImageService = {
            toMatrixBinaryFrame: vi.fn(),
        };

        mockImageServiceFactory = {
            fromBuffer: vi.fn().mockReturnValue(mockImageService),
            fromUrl: vi.fn().mockResolvedValue(mockImageService),
        };

        const restPreview = new RestPreview(
            mockS3Service as unknown as S3Service,
            mockImageServiceFactory as unknown as ImageServiceFactory
        );

        app = createPublicTestApp(restPreview.createRouter(), "/preview");
    });

    describe("GET /s3", () => {
        it("should return a binary frame for an S3 image", async () => {
            const buffer = Buffer.from("image-data");
            const frame = Buffer.from([0x01, 0x02, 0x03]);

            mockS3Service.downloadToBuffer.mockResolvedValue(buffer);
            mockImageService.toMatrixBinaryFrame.mockResolvedValue(frame);

            const response = await request(app)
                .get("/preview/s3")
                .query({ mode: "music", s3_key: "user-123/file.png" })
                .buffer(true)
                .parse(parseBinary)
                .expect(200);

            expect(mockS3Service.downloadToBuffer).toHaveBeenCalledWith("user-123/file.png");
            expect(mockImageServiceFactory.fromBuffer).toHaveBeenCalledWith(buffer);
            expect(mockImageService.toMatrixBinaryFrame).toHaveBeenCalledWith(TargetMode.MusicMode, 64, 64);
            expect(response.headers["content-type"]).toContain("application/octet-stream");
            expect(response.body).toEqual(frame);
        });

        it("should return 404 if the S3 file does not exist", async () => {
            mockS3Service.downloadToBuffer.mockResolvedValue(null);

            const response = await request(app)
                .get("/preview/s3")
                .query({ mode: "image", s3_key: "missing.png" })
                .expect(404);

            expect(response.body.data.message).toBe("S3 File not found");
        });

        it("should return 400 if required query params are missing", async () => {
            const response = await request(app).get("/preview/s3").expect(400);

            expect(response.body.details).toContain("mode is required");
            expect(response.body.details).toContain("s3_key is required");
        });
    });

    describe("GET /url", () => {
        it("should return a binary frame for a URL image", async () => {
            const frame = Buffer.from([0x09, 0x08, 0x07]);

            mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
            mockImageService.toMatrixBinaryFrame.mockResolvedValue(frame);

            const response = await request(app)
                .get("/preview/url")
                .query({ mode: "image", url: "https://example.com/image.png" })
                .buffer(true)
                .parse(parseBinary)
                .expect(200);

            expect(mockImageServiceFactory.fromUrl).toHaveBeenCalledWith("https://example.com/image.png");
            expect(mockImageService.toMatrixBinaryFrame).toHaveBeenCalledWith(TargetMode.ImageMode, 64, 64);
            expect(response.headers["content-type"]).toContain("application/octet-stream");
            expect(response.body).toEqual(frame);
        });

        it("should return 400 if required query params are missing", async () => {
            const response = await request(app).get("/preview/url").expect(400);

            expect(response.body.details).toContain("mode is required");
            expect(response.body.details).toContain("url is required");
        });

        it("should reject localhost and private IP URLs", async () => {
            mockLookup.mockClear();

            const response = await request(app)
                .get("/preview/url")
                .query({ mode: "image", url: "http://127.0.0.1/secret" })
                .expect(400);

            expect(response.body.data.message).toBe("URL not allowed");
            expect(response.body.data.details).toBe("Private IPs are not allowed");
            expect(mockImageServiceFactory.fromUrl).not.toHaveBeenCalled();
        });
    });
});

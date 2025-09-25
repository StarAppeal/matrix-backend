import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner");

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
    const originalModule = await importOriginal<typeof import("@aws-sdk/client-s3")>();
    return {
        ...originalModule,
        S3Client: vi.fn(),
    };
});

import { S3Service, S3ClientConfig } from "../../src/services/s3Service";
import {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const testConfig: S3ClientConfig = {
    endpoint: "http://test-minio",
    port: 9000,
    accessKey: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
};

const MockS3Client = vi.mocked(S3Client);
const mockSend = vi.fn();
const mockGetSignedUrl = vi.mocked(getSignedUrl);

describe("S3Service", () => {
    let s3Service: S3Service;

    beforeEach(() => {
        vi.clearAllMocks();

        MockS3Client.mockImplementation(
            () =>
                ({
                    send: mockSend,
                }) as never
        );

        s3Service = S3Service.getInstance(testConfig);
    });

    describe("Initialization and Bucket Creation", () => {
        it("should create a singleton instance correctly", () => {
            const instance1 = S3Service.getInstance(testConfig);
            const instance2 = S3Service.getInstance();
            expect(instance1).toBe(instance2);
            expect(MockS3Client).toHaveBeenCalledOnce();
        });

        it("should call ensureBucketExists and handle existing buckets gracefully", async () => {
            mockSend.mockRejectedValue({ name: "BucketAlreadyOwnedByYou" });

            await expect(s3Service.ensureBucketExists()).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
        });

        it("should create a new bucket if it does not exist", async () => {
            mockSend.mockResolvedValue({});

            await expect(s3Service.ensureBucketExists()).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
        });
    });

    describe("uploadFile", () => {
        it("should upload a file and return the correct object key", async () => {
            const mockFile = {
                originalname: "test-image.jpg",
                buffer: Buffer.from("test-data"),
                mimetype: "image/jpeg",
            };

            const userId = "user-123";

            const objectKey = await s3Service.uploadFile(mockFile as never, userId);

            expect(objectKey).toMatch(/^user-user-123\/[a-f0-9-]+\.jpg$/);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));

            const sentCommand = (mockSend.mock.calls[0][0] as PutObjectCommand).input;

            expect(sentCommand.Bucket).toBe("test-bucket");
            expect(sentCommand.Key).toBe(objectKey);
            expect(sentCommand.Body).toBe(mockFile.buffer);
        });
    });

    describe("listFilesForUser", () => {
        const userId = "user-123";

        it("should return a correctly formatted list of files for a user", async () => {
            const mockS3Response = {
                Contents: [
                    { Key: `user-${userId}/file1.txt`, LastModified: new Date("2023-01-01") },
                    { Key: `user-${userId}/image.jpg`, LastModified: new Date("2023-01-02") },
                ],
            };
            mockSend.mockResolvedValue(mockS3Response);

            const files = await s3Service.listFilesForUser(userId);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));

            const sentCommand = (mockSend.mock.calls[0][0] as ListObjectsV2Command).input;
            expect(sentCommand.Bucket).toBe("test-bucket");
            expect(sentCommand.Prefix).toBe(`user-${userId}/`);

            expect(files).toHaveLength(2);
            expect(files).toEqual([
                { key: `user-${userId}/file1.txt`, lastModified: new Date("2023-01-01") },
                { key: `user-${userId}/image.jpg`, lastModified: new Date("2023-01-02") },
            ]);
        });

        it("should return an empty array if the user has no files", async () => {
            const mockS3Response = {
                Contents: [],
            };
            mockSend.mockResolvedValue(mockS3Response);

            const files = await s3Service.listFilesForUser(userId);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(files).toEqual([]);
        });

        it("should return an empty array if the S3 response has no 'Contents' property", async () => {
            const mockS3Response = {};
            mockSend.mockResolvedValue(mockS3Response);

            const files = await s3Service.listFilesForUser(userId);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(files).toEqual([]);
        });
    });

    describe("deleteFile", () => {
        it("should call the S3 client with the correct DeleteObjectCommand", async () => {
            const objectKey = "user-123/some-file-to-delete.txt";
            mockSend.mockResolvedValue({});

            await expect(s3Service.deleteFile(objectKey)).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));

            const sentCommand = (mockSend.mock.calls[0][0] as DeleteObjectCommand).input;
            expect(sentCommand.Bucket).toBe("test-bucket");
            expect(sentCommand.Key).toBe(objectKey);
        });

        it("should throw an error if the S3 client fails to delete the object", async () => {
            const objectKey = "user-123/failing-file.txt";
            const s3Error = new Error("Access Denied");
            mockSend.mockRejectedValue(s3Error);

            await expect(s3Service.deleteFile(objectKey)).rejects.toThrow("Access Denied");
        });
    });

    describe("getSignedDownloadUrl", () => {
        it("should generate a signed URL for a given object key", async () => {
            const objectKey = "user-123/image.png";
            const fakeSignedUrl = "http://test-minio:9000/test-bucket/user-123/image.png?signed=true";

            mockGetSignedUrl.mockResolvedValue(fakeSignedUrl);

            const signedUrl = await s3Service.getSignedDownloadUrl(objectKey, 300);

            expect(signedUrl).toBe(fakeSignedUrl);

            expect(mockGetSignedUrl).toHaveBeenCalledOnce();
            expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(GetObjectCommand), {
                expiresIn: 300,
            });

            const passedCommand = (mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand).input;
            expect(passedCommand.Bucket).toBe("test-bucket");
            expect(passedCommand.Key).toBe(objectKey);
        });
    });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/s3-request-presigner");

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
    const originalModule = await importOriginal<typeof import("@aws-sdk/client-s3")>();
    return {
        ...originalModule,
        S3Client: vi.fn(),
    };
});

vi.mock("../../src/services/db/fileService", () => ({
    FileService: {
        getInstance: vi.fn(),
    },
}));

import { S3Service, S3ClientConfig } from "../../src/services/s3Service";
import { S3Client, CreateBucketCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileService } from "../../src/services/db/fileService";
import { File } from "../../src/db/models/file";

const testConfig: S3ClientConfig = {
    endpoint: "http://test-minio",
    port: 9000,
    accessKey: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
    publicUrl: "http://test-publicUrl",
};

const MockS3Client = vi.mocked(S3Client);
const mockSend = vi.fn();
const mockGetSignedUrl = vi.mocked(getSignedUrl);
const mockFileService = {
    createFileRecord: vi.fn(),
    getFilesByUserId: vi.fn(),
    isFileDuplicate: vi.fn(),
    deleteFileRecord: vi.fn(),
    updateObjectKey: vi.fn(),
};

describe("S3Service", () => {
    let s3Service: S3Service;

    beforeEach(() => {
        vi.clearAllMocks();

        MockS3Client.mockImplementation(
            () =>
                ({
                    send: mockSend,
                    config: {
                        region: "mock-region",
                        credentials: {
                            accessKeyId: "mock-access-key",
                            secretAccessKey: "mock-secret-key",
                        },
                    },
                }) as never
        );

        vi.mocked(FileService.getInstance).mockReturnValue(mockFileService as any);

        // @ts-ignore
        S3Service.instance = undefined;

        s3Service = S3Service.getInstance(testConfig, mockFileService as any);
    });

    describe("Initialization and Bucket Creation", () => {
        it("should create a singleton instance correctly", () => {
            const instance1 = S3Service.getInstance(testConfig);
            const instance2 = S3Service.getInstance();
            expect(instance1).toBe(instance2);
            expect(MockS3Client).toHaveBeenCalledOnce();
        });

        it("should call ensureBucketExists and handle existing buckets gracefully", async () => {
            const bucketError = new Error();
            bucketError.name = "BucketAlreadyOwnedByYou";
            mockSend.mockRejectedValue(bucketError);
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
                size: 1024,
            };

            const userId = "user-123";
            mockSend.mockResolvedValue({});
            mockFileService.createFileRecord.mockResolvedValue({});

            const objectKey = await s3Service.uploadFile(mockFile as never, userId);

            expect(objectKey).toMatch(/^user-user-123\/[a-f0-9-]+_test-image\.jpg$/);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));

            const sentCommand = (mockSend.mock.calls[0][0] as PutObjectCommand).input;

            expect(sentCommand.Bucket).toBe("test-bucket");
            expect(sentCommand.Key).toBe(objectKey);
            expect(sentCommand.Body).toBe(mockFile.buffer);

            expect(mockFileService.createFileRecord).toHaveBeenCalledWith(
                userId,
                objectKey,
                mockFile.originalname,
                mockFile.mimetype,
                mockFile.size
            );
        });
    });

    describe("listFilesForUser", () => {
        const userId = "user-123";

        it("should return a correctly formatted list of files for a user", async () => {
            const mockDbFiles: Partial<File>[] = [
                {
                    objectKey: `user-${userId}/uuid1_file1.txt`,
                    originalName: "file1.txt",
                    mimeType: "text/plain",
                    size: 100,
                    uploadedAt: new Date("2023-01-01"),
                },
                {
                    objectKey: `user-${userId}/uuid2_image.jpg`,
                    originalName: "image.jpg",
                    mimeType: "image/jpeg",
                    size: 1024,
                    uploadedAt: new Date("2023-01-02"),
                },
            ];
            mockFileService.getFilesByUserId.mockResolvedValue(mockDbFiles);

            const files = await s3Service.listFilesForUser(userId);

            expect(mockFileService.getFilesByUserId).toHaveBeenCalledWith(userId);

            expect(files).toHaveLength(2);
            expect(files).toContainEqual({
                key: `user-${userId}/uuid1_file1.txt`,
                lastModified: new Date("2023-01-01"),
                originalName: "file1.txt",
                mimeType: "text/plain",
                size: 100,
            });
            expect(files).toContainEqual({
                key: `user-${userId}/uuid2_image.jpg`,
                lastModified: new Date("2023-01-02"),
                originalName: "image.jpg",
                mimeType: "image/jpeg",
                size: 1024,
            });
        });

        it("should return an empty array if the user has no files", async () => {
            mockFileService.getFilesByUserId.mockResolvedValue([]);

            const files = await s3Service.listFilesForUser(userId);

            expect(mockFileService.getFilesByUserId).toHaveBeenCalledWith(userId);
            expect(files).toEqual([]);
        });
    });

    describe("deleteFile", () => {
        it("should call the S3 client with the correct DeleteObjectCommand and delete the file record", async () => {
            const objectKey = "user-123/some-file-to-delete.txt";
            mockSend.mockResolvedValue({});
            mockFileService.deleteFileRecord.mockResolvedValue(true);

            await expect(s3Service.deleteFile(objectKey)).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));

            const sentCommand = (mockSend.mock.calls[0][0] as DeleteObjectCommand).input;
            expect(sentCommand.Bucket).toBe("test-bucket");
            expect(sentCommand.Key).toBe(objectKey);

            expect(mockFileService.deleteFileRecord).toHaveBeenCalledWith(objectKey);
        });

        it("should throw an error if the S3 client fails to delete the object", async () => {
            const objectKey = "user-123/failing-file.txt";
            const s3Error = new Error("Access Denied");
            mockSend.mockRejectedValue(s3Error);

            await expect(s3Service.deleteFile(objectKey)).rejects.toThrow("Access Denied");

            expect(mockFileService.deleteFileRecord).not.toHaveBeenCalled();
        });
    });

    describe("isFileDuplicate", () => {
        it("should use FileService to check for duplicate files", async () => {
            const userId = "user-123";
            const mockFile = {
                originalname: "duplicate-image.jpg",
                buffer: Buffer.from("test-data"),
                mimetype: "image/jpeg",
            };

            mockFileService.isFileDuplicate.mockResolvedValue(true);

            const isDuplicate = await s3Service.isFileDuplicate(mockFile as never, userId);

            expect(isDuplicate).toBe(true);
            expect(mockFileService.isFileDuplicate).toHaveBeenCalledWith(mockFile.originalname, userId);
        });

        it("should correctly identify non-duplicate files", async () => {
            const userId = "user-123";
            const mockFile = {
                originalname: "new-image.jpg",
                buffer: Buffer.from("test-data"),
                mimetype: "image/jpeg",
            };

            mockFileService.isFileDuplicate.mockResolvedValue(false);

            const isDuplicate = await s3Service.isFileDuplicate(mockFile as never, userId);

            expect(isDuplicate).toBe(false);
            expect(mockFileService.isFileDuplicate).toHaveBeenCalledWith(mockFile.originalname, userId);
        });
    });

    describe("getSignedDownloadUrl", () => {
        it("should generate a signed URL for a given object key", async () => {
            const objectKey = "user-123/image.png";
            const fakeSignedUrl = "http://test-publicUrl/test-bucket/user-123/image.png?signed=true";

            mockGetSignedUrl.mockResolvedValue(fakeSignedUrl);

            const signedUrl = await s3Service.getSignedDownloadUrl(objectKey, 300);

            expect(signedUrl).toBe(fakeSignedUrl);

            expect(mockGetSignedUrl).toHaveBeenCalledOnce();
            expect(mockGetSignedUrl).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    input: {
                        Bucket: "test-bucket",
                        Key: objectKey,
                    },
                }),
                { expiresIn: 300 }
            );
        });
    });
});

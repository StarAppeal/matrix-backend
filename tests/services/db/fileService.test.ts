import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileModel } from "../../../src/db/models/file";
import { FileService } from "../../../src/services/db/fileService";
import logger from "../../../src/utils/logger";

vi.mock("../../../src/db/models/file");

const mockedFileModel = vi.mocked(FileModel);

vi.mock("../../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("FileService", () => {
    let fileService: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        (FileService as any).instance = undefined;
        fileService = FileService.getInstance();
    });

    describe("getInstance (singleton)", () => {
        it("should create a singleton instance", () => {
            const instance1 = fileService;
            const instance2 = FileService.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe("createFileRecord", () => {
        it("should create a file record and return it", async () => {
            const mockDate = new Date();
            vi.useFakeTimers();
            vi.setSystemTime(mockDate);

            const mockFile = {
                userId: "user123",
                objectKey: "object-key-123",
                originalName: "test-file.txt",
                mimeType: "text/plain",
                size: 1024,
                uploadedAt: mockDate,
                save: vi.fn().mockResolvedValue({
                    userId: "user123",
                    objectKey: "object-key-123",
                    originalName: "test-file.txt",
                    mimeType: "text/plain",
                    size: 1024,
                    uploadedAt: mockDate,
                }),
            };

            mockedFileModel.mockImplementation(() => mockFile as any);

            const result = await fileService.createFileRecord(
                "user123",
                "object-key-123",
                "test-file.txt",
                "text/plain",
                1024
            );

            expect(mockedFileModel).toHaveBeenCalledWith({
                userId: "user123",
                objectKey: "object-key-123",
                originalName: "test-file.txt",
                mimeType: "text/plain",
                size: 1024,
                uploadedAt: mockDate,
            });

            expect(mockFile.save).toHaveBeenCalled();
            expect(result).toEqual({
                userId: "user123",
                objectKey: "object-key-123",
                originalName: "test-file.txt",
                mimeType: "text/plain",
                size: 1024,
                uploadedAt: mockDate,
            });

            vi.useRealTimers();
        });
    });

    describe("getFilesByUserId", () => {
        it("should return files for a given userId", async () => {
            const mockFiles = [
                { objectKey: "object1", originalName: "file1.txt" },
                { objectKey: "object2", originalName: "file2.txt" },
            ];

            const mockExec = vi.fn().mockResolvedValue(mockFiles);
            const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
            mockedFileModel.find.mockReturnValue({ sort: mockSort } as any);

            const result = await fileService.getFilesByUserId("user123");

            expect(mockedFileModel.find).toHaveBeenCalledWith({ userId: "user123" });
            expect(mockSort).toHaveBeenCalledWith({ uploadedAt: -1 });
            expect(result).toEqual(mockFiles);
        });
    });

    describe("getFileByObjectKey", () => {
        it("should return a file for a given objectKey", async () => {
            const mockFile = { objectKey: "object-key-123", originalName: "file1.txt" };

            const mockExec = vi.fn().mockResolvedValue(mockFile);
            mockedFileModel.findOne.mockReturnValue({ exec: mockExec } as any);

            const result = await fileService.getFileByObjectKey("object-key-123");

            expect(mockedFileModel.findOne).toHaveBeenCalledWith({ objectKey: "object-key-123" });
            expect(result).toEqual(mockFile);
        });

        it("should return null if file not found", async () => {
            const mockExec = vi.fn().mockResolvedValue(null);
            mockedFileModel.findOne.mockReturnValue({ exec: mockExec } as any);

            const result = await fileService.getFileByObjectKey("non-existent-key");

            expect(result).toBeNull();
        });
    });

    describe("deleteFileRecord", () => {
        it("should delete a file record and return true on success", async () => {
            mockedFileModel.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);

            const result = await fileService.deleteFileRecord("object-key-123");

            expect(mockedFileModel.deleteOne).toHaveBeenCalledWith({ objectKey: "object-key-123" });
            expect(result).toBe(true);
        });

        it("should return false if no file was deleted", async () => {
            mockedFileModel.deleteOne.mockResolvedValue({ deletedCount: 0 } as any);

            const result = await fileService.deleteFileRecord("non-existent-key");

            expect(result).toBe(false);
        });
    });

    describe("isFileDuplicate", () => {
        it("should return true if a file with the same name exists for the user", async () => {
            mockedFileModel.countDocuments.mockResolvedValue(1);

            const result = await fileService.isFileDuplicate("duplicate-file.txt", "user123");

            expect(mockedFileModel.countDocuments).toHaveBeenCalledWith({
                userId: "user123",
                originalName: "duplicate-file.txt",
            });
            expect(result).toBe(true);
        });

        it("should return false if no duplicate file exists", async () => {
            mockedFileModel.countDocuments.mockResolvedValue(0);

            const result = await fileService.isFileDuplicate("unique-file.txt", "user123");

            expect(result).toBe(false);
        });

        it("should return false if an error occurs", async () => {
            mockedFileModel.countDocuments.mockRejectedValue(new Error("Database error"));

            const result = await fileService.isFileDuplicate("error-file.txt", "user123");

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Error checking file duplicate"));
        });
    });

    describe("updateObjectKey", () => {
        it("should update object key and return the updated file", async () => {
            const mockFile = {
                _id: "file123",
                objectKey: "new-object-key",
                originalName: "test.txt",
            };

            const mockExec = vi.fn().mockResolvedValue(mockFile);
            mockedFileModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

            const result = await fileService.updateObjectKey("file123", "new-object-key");

            expect(mockedFileModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "file123",
                { objectKey: "new-object-key" },
                { new: true }
            );
            expect(result).toEqual(mockFile);
        });

        it("should return null if file not found", async () => {
            const mockExec = vi.fn().mockResolvedValue(null);
            mockedFileModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec } as any);

            const result = await fileService.updateObjectKey("non-existent-id", "new-object-key");

            expect(result).toBeNull();
        });
    });
});

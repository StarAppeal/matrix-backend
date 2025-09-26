import { FileModel, File } from "../../db/models/file";
import logger from "../../utils/logger";

export class FileService {
    private static instance: FileService;

    private constructor() {}

    public static getInstance(): FileService {
        if (!this.instance) {
            this.instance = new FileService();
        }
        return this.instance;
    }

    async createFileRecord(
        userId: string,
        objectKey: string,
        originalName: string,
        mimeType: string,
        size: number
    ): Promise<File> {
        const fileRecord = new FileModel({
            userId,
            objectKey,
            originalName,
            mimeType,
            size,
            uploadedAt: new Date(),
        });

        return await fileRecord.save();
    }

    async getFilesByUserId(userId: string): Promise<File[]> {
        return FileModel.find({ userId }).sort({ uploadedAt: -1 }).exec();
    }

    async getFileByObjectKey(objectKey: string): Promise<File | null> {
        return FileModel.findOne({ objectKey }).exec();
    }

    async deleteFileRecord(objectKey: string): Promise<boolean> {
        const result = await FileModel.deleteOne({ objectKey });
        return result.deletedCount > 0;
    }

    async isFileDuplicate(originalName: string, userId: string): Promise<boolean> {
        try {
            const count = await FileModel.countDocuments({
                userId,
                originalName,
            });

            return count > 0;
        } catch (error) {
            logger.error(`Error checking file duplicate: ${error}`);
            return false;
        }
    }

    async updateObjectKey(fileId: string, objectKey: string): Promise<File | null> {
        return FileModel.findByIdAndUpdate(fileId, { objectKey }, { new: true }).exec();
    }
}

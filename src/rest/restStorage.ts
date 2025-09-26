import { S3Service } from "../services/s3Service";
import multer from "multer";
import express from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { badRequest, created, forbidden, notFound, ok } from "./utils/responses";

export class RestStorage {
    constructor(private readonly s3Service: S3Service) {}

    public createRouter() {
        const router = express.Router();

        const upload = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 },
        });

        router.post(
            "/upload",
            upload.single("image"),
            asyncHandler(async (req, res) => {
                if (!req.file) {
                    return badRequest(res, "No file provided.");
                }

                const userId = req.payload.uuid;

                const isDuplicate = await this.s3Service.isFileDuplicate(req.file, userId);
                if (isDuplicate) {
                    return badRequest(res, "File was already uploaded.");
                }

                const objectKey = await this.s3Service.uploadFile(req.file, userId);

                return created(res, { message: "File uploaded successfully", objectKey });
            })
        );

        router.get(
            "/files",
            asyncHandler(async (req, res) => {
                const userId = req.payload.uuid;
                const files = await this.s3Service.listFilesForUser(userId);

                return ok(res, files);
            })
        );

        router.get(
            /\/files\/(.*)\/url$/,
            asyncHandler(async (req, res) => {
                const userId = req.payload.uuid;
                const objectKey = req.params[0];

                if (!objectKey || !objectKey.startsWith(`user-${userId}`)) {
                    return forbidden(res);
                }

                try {
                    const expiresInSeconds = 60;
                    const downloadUrl = await this.s3Service.getSignedDownloadUrl(objectKey, expiresInSeconds);

                    return ok(res, { url: downloadUrl });
                } catch (error: any) {
                    if (error.name === "NoSuchKey") {
                        return notFound(res, "File not found.");
                    } else {
                        throw error;
                    }
                }
            })
        );

        router.delete(
            /\/files\/(.*)/,
            asyncHandler(async (req, res) => {
                const userId = req.payload.uuid;
                const objectKey = req.params[0];

                if (!objectKey.startsWith(`user-${userId}/`)) {
                    return forbidden(res);
                }

                await this.s3Service.deleteFile(objectKey);

                return ok(res, "File deleted successfully");
            })
        );

        return router;
    }
}

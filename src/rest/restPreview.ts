import express from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { notFound } from "./utils/responses";
import { validateQuery, v } from "./middleware/validate";
import { blockUnsafeUrlQuery } from "./middleware/blockUnsafeUrlQuery";
import { ImageServiceFactory, TargetMode } from "../services/imageService";
import { S3Service } from "../services/s3Service";

const allowedPreviewModes = ["image", "music"];

export class RestPreview {
    constructor(
        private readonly s3Service: S3Service,
        private readonly imageServiceFactory: ImageServiceFactory
    ) {}

    public createRouter() {
        const router = express.Router();

        router.get(
            "/s3",
            validateQuery({
                mode: { required: true, validator: v.isEnum(allowedPreviewModes) },
                s3_key: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (req, res) => {
                const { mode, s3_key } = req.query as { mode: string; s3_key: string };
                
                const buffer = await this.s3Service.downloadToBuffer(s3_key);
                if (!buffer) {
                    return notFound(res, "S3 File not found");
                }
                const imageService = this.imageServiceFactory.fromBuffer(buffer);

                const targetMode = mode === "music" ? TargetMode.MusicMode : TargetMode.ImageMode;
                const frame = await imageService.toMatrixBinaryFrame(targetMode, 64, 64);
                
                res.setHeader("Content-Type", "application/octet-stream");
                res.send(frame);
            })
        );

        router.get(
            "/url",
            validateQuery({
                mode: { required: true, validator: v.isEnum(allowedPreviewModes) },
                url: { required: true, validator: v.isUrl() },
            }),
            blockUnsafeUrlQuery("url"),
            asyncHandler(async (req, res) => {
                const { mode, url } = req.query as { mode: string; url: string };

                const imageService = await this.imageServiceFactory.fromUrl(url);

                const targetMode = mode === "music" ? TargetMode.MusicMode : TargetMode.ImageMode;
                const frame = await imageService.toMatrixBinaryFrame(targetMode, 64, 64);
                
                res.setHeader("Content-Type", "application/octet-stream");
                res.send(frame);
            })
        );

        return router;
    }
}

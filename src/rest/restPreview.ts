import express from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { notFound } from "./utils/responses";
import { validateQuery, v } from "./middleware/validate";
import { blockUnsafeUrlQuery } from "./middleware/blockUnsafeUrlQuery";
import { ImageFitMode, ImageServiceFactory, TargetMode } from "../services/imageService";
import { S3Service } from "../services/s3Service";

const allowedPreviewModes = ["image", "music"] as const;
const allowedFitModes = ["contain", "cover", "fill"] as const;

export class RestPreview {
    constructor(
        private readonly s3Service: S3Service,
        private readonly imageServiceFactory: ImageServiceFactory
    ) {}

    private async buildPreviewFrame(
        mode: string,
        fit: ImageFitMode | undefined,
        imageService: ReturnType<ImageServiceFactory["fromBuffer"]> | Awaited<ReturnType<ImageServiceFactory["fromUrl"]>>
    ) {
        const targetMode = mode === "music" ? TargetMode.MusicMode : TargetMode.ImageMode;
        const fitMode = mode === "image" ? fit : undefined;
        if (fitMode === undefined) {
            return imageService.toMatrixBinaryFrame(targetMode, 64, 64);
        }
        return imageService.toMatrixBinaryFrame(targetMode, 64, 64, fitMode);
    }

    public createRouter() {
        const router = express.Router();

        router.get(
            "/s3",
            validateQuery({
                mode: { required: true, validator: v.isEnum(allowedPreviewModes) },
                s3_key: { required: true, validator: v.isString({ nonEmpty: true }) },
                fit: { required: false, validator: v.isEnum(allowedFitModes) },
            }),
            asyncHandler(async (req, res) => {
                const { mode, s3_key, fit } = req.query as { mode: string; s3_key: string; fit?: string };

                const buffer = await this.s3Service.downloadToBuffer(s3_key);
                if (!buffer) {
                    return notFound(res, "S3 File not found");
                }
                const imageService = this.imageServiceFactory.fromBuffer(buffer);

                const frame = await this.buildPreviewFrame(mode, fit as ImageFitMode | undefined, imageService);

                res.setHeader("Content-Type", "application/octet-stream");
                res.send(frame);
            })
        );

        router.get(
            "/url",
            validateQuery({
                mode: { required: true, validator: v.isEnum(allowedPreviewModes) },
                url: { required: true, validator: v.isUrl() },
                fit: { required: false, validator: v.isEnum(allowedFitModes) },
            }),
            blockUnsafeUrlQuery("url"),
            asyncHandler(async (req, res) => {
                const { mode, url, fit } = req.query as { mode: string; url: string; fit?: string };

                const imageService = await this.imageServiceFactory.fromUrl(url);
                const frame = await this.buildPreviewFrame(mode, fit as ImageFitMode | undefined, imageService);

                res.setHeader("Content-Type", "application/octet-stream");
                res.send(frame);
            })
        );

        return router;
    }
}

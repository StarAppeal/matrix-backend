import {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileService } from "./db/fileService";
import { randomUUID } from "crypto";
import logger from "../utils/logger";
import sharp from "sharp";

export interface S3ClientConfig {
    endpoint: string;
    port: number;
    accessKey: string;
    secretAccessKey: string;
    bucket: string;
    region?: string;
    publicUrl: string;
}

export type S3ObjectVariant = "matrix64" | "original";

export class S3Service {
    private static instance: S3Service;

    private readonly client: S3Client;
    private readonly bucketName: string;
    private readonly publicUrl: string;
    private readonly fileService: FileService;

    private constructor(clientConfig: S3ClientConfig, fileService: FileService) {
        this.client = new S3Client({
            endpoint: `${clientConfig.endpoint}:${clientConfig.port}`,
            forcePathStyle: true,
            region: clientConfig.region || "us-east-1",
            credentials: {
                accessKeyId: clientConfig.accessKey,
                secretAccessKey: clientConfig.secretAccessKey,
            },
        });

        this.bucketName = clientConfig.bucket;
        this.publicUrl = clientConfig.publicUrl;
        this.fileService = fileService;
    }

    public static getInstance(config?: S3ClientConfig, fileService?: FileService): S3Service {
        if (!this.instance) {
            if (!config || !fileService) {
                throw new Error("S3Service must be initialized with a config and fileService on first use.");
            }
            this.instance = new S3Service(config, fileService);
        }
        return this.instance;
    }

    async ensureBucketExists(): Promise<void> {
        try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
            logger.info(`Bucket "${this.bucketName}" created successfully or already existed.`);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
                    logger.info(`Bucket "${this.bucketName}" already exists.`);
                } else {
                    throw err;
                }
            } else {
                throw new Error("Unknown error occurred while creating bucket.");
            }
        }
    }

    async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
        const uuid = randomUUID();
        const objectKey = `user-${userId}/${uuid}_${file.originalname}`;
        const matrixObjectKey = this.getVariantObjectKey(objectKey, "matrix64");

        const { buffer: matrixBuffer, contentType: matrixContentType } = await this.createMatrixVariantFromBuffer(
            file.buffer,
            file.mimetype
        );

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            Metadata: {
                matrix64key: matrixObjectKey,
                variant: "original",
            },
        });

        const matrixCommand = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: matrixObjectKey,
            Body: matrixBuffer,
            ContentType: matrixContentType,
            Metadata: {
                sourcekey: objectKey,
                variant: "matrix64",
            },
        });

        await Promise.all([this.client.send(command), this.client.send(matrixCommand)]);

        await this.fileService.createFileRecord(userId, objectKey, file.originalname, file.mimetype, file.size);

        return objectKey;
    }

    async listFilesForUser(
        userId: string
    ): Promise<{ key: string; lastModified: Date; originalName: string; mimeType: string; size: number }[]> {
        const files = await this.fileService.getFilesByUserId(userId);

        return files.map((file) => ({
            key: file.objectKey,
            lastModified: file.uploadedAt,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
        }));
    }

    async isFileDuplicate(file: Express.Multer.File, userId: string): Promise<boolean> {
        return await this.fileService.isFileDuplicate(file.originalname, userId);
    }

    async deleteFile(objectKey: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
        });

        const matrixCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: this.getVariantObjectKey(objectKey, "matrix64"),
        });

        await Promise.all([this.client.send(command), this.client.send(matrixCommand)]);

        await this.fileService.deleteFileRecord(objectKey);

        logger.info(`File deleted: ${objectKey}`);
    }

    async getSignedDownloadUrl(objectKey: string, expiresIn: number = 60, variant?: S3ObjectVariant): Promise<string> {
        // temporary client for public url
        const signingClient = new S3Client({
            endpoint: this.publicUrl,
            forcePathStyle: true,
            region: this.client.config.region,
            credentials: this.client.config.credentials,
        });

        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.getVariantObjectKey(objectKey, variant),
        });

        return await getSignedUrl(signingClient, command, { expiresIn });
    }

    private getVariantObjectKey(objectKey: string, variant?: S3ObjectVariant): string {
        if (!variant || variant === "original") {
            return objectKey;
        }
        return `${objectKey}_${variant}`;
    }

    private async createMatrixVariantFromBuffer(
        buffer: Buffer,
        mimeType: string
    ): Promise<{ buffer: Buffer; contentType: string }> {
        const isGif = mimeType === "image/gif";
        const image = isGif ? sharp(buffer, { animated: true }) : sharp(buffer);
        const outputFormat = isGif ? "gif" : "png";
        const outputContentType = isGif ? "image/gif" : "image/png";

        const resizedBuffer = await image
            .resize({ width: 64, height: 64, fit: "inside" })
            .toFormat(outputFormat)
            .toBuffer();

        return { buffer: resizedBuffer, contentType: outputContentType };
    }

//TODO: remove
    public async migrateFileToIncludeMatrix(objectKey: string, mimeType: string): Promise<boolean> {
        const matrixObjectKey = this.getVariantObjectKey(objectKey, "matrix64");

        try {
            try {
                await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: matrixObjectKey }));
                return false;
            } catch (err: any) {
                if (err.name !== "NotFound") throw err;
            }

            const getCommand = new GetObjectCommand({ Bucket: this.bucketName, Key: objectKey });
            const { Body } = await this.client.send(getCommand);
            if (!Body) throw new Error("Empty body from S3");

            const buffer = Buffer.from(await Body.transformToByteArray());

            await this.client.send(
                new CopyObjectCommand({
                    Bucket: this.bucketName,
                    CopySource: `${this.bucketName}/${objectKey}`,
                    Key: objectKey,
                    ContentType: mimeType,
                    MetadataDirective: "REPLACE",
                    Metadata: {
                        matrix64key: matrixObjectKey,
                        variant: "original",
                    },
                })
            );

            const { buffer: matrixBuffer, contentType: matrixContentType } = await this.createMatrixVariantFromBuffer(
                buffer,
                mimeType
            );

            await this.client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: matrixObjectKey,
                    Body: matrixBuffer,
                    ContentType: matrixContentType,
                    Metadata: {
                        sourcekey: objectKey,
                        variant: "matrix64",
                    },
                })
            );

            return true;
        } catch (error) {
            logger.error(`Error migrating ${objectKey}:`, error);
            throw error;
        }
    }
}

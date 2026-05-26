import {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileService } from "./db/fileService";
import { randomUUID } from "crypto";
import logger from "../utils/logger";

export interface S3ClientConfig {
    endpoint: string;
    accessKey: string;
    secretAccessKey: string;
    bucket: string;
}

export class S3Service {
    private static instance: S3Service;

    private readonly client: S3Client;
    private readonly bucketName: string;
    private readonly fileService: FileService;

    private constructor(clientConfig: S3ClientConfig, fileService: FileService) {
        this.client = new S3Client({
            endpoint: clientConfig.endpoint,
            forcePathStyle: false,
            region: "auto",
            credentials: {
                accessKeyId: clientConfig.accessKey,
                secretAccessKey: clientConfig.secretAccessKey,
            },
        });

        this.bucketName = clientConfig.bucket;
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
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
            logger.info(`Bucket "${this.bucketName}" verified successfully.`);
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.name === "NotFound" || err.name === "404") {
                    logger.error(`Bucket "${this.bucketName}" does not exist! Please create it in the Cloudflare UI.`);
                    throw new Error(`Bucket "${this.bucketName}" not found.`);
                }
                else if (err.name === "AccessDenied" || err.name === "Forbidden") {
                    logger.warn(
                        `Access Denied while verifying bucket "${this.bucketName}". Assuming it exists and continuing...`
                    );
                } else {
                    throw err;
                }
            } else {
                throw new Error("Unknown error occurred while verifying bucket.");
            }
        }
    }

    async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
        const uuid = randomUUID();
        const objectKey = `user-${userId}/${uuid}_${file.originalname}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        });

        await this.client.send(command);

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

        await this.client.send(command);

        await this.fileService.deleteFileRecord(objectKey);

        logger.info(`File deleted: ${objectKey}`);
    }

    async getSignedDownloadUrl(objectKey: string, expiresIn: number = 60): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
        });

        return await getSignedUrl(this.client, command, { expiresIn });
    }

    public async downloadToBuffer(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.client.send(command);

        const byteArray = await response.Body?.transformToByteArray();
        if (!byteArray) {
            throw new Error(`S3 Object ${key} is empty.`);
        }

        return Buffer.from(byteArray);
    }
}

import {
    S3Client,
    CreateBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

export interface S3ClientConfig {
    endpoint: string;
    port: number;
    accessKey: string;
    secretAccessKey: string;
    bucket: string;
    region?: string;
    publicUrl: string;
}

export class S3Service {
    private static instance: S3Service;

    private readonly client: S3Client;
    private readonly bucketName: string;
    private readonly publicUrl: string;

    private constructor(clientConfig: S3ClientConfig) {
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
    }

    public static getInstance(config?: S3ClientConfig): S3Service {
        if (!this.instance) {
            if (!config) {
                throw new Error("S3Service must be initialized with a config on first use.");
            }
            this.instance = new S3Service(config);
        }
        return this.instance;
    }

    async ensureBucketExists(): Promise<void> {
        try {
            await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
            console.log(`Bucket "${this.bucketName}" created successfully or already existed.`);
        } catch (err: any) {
            if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
                console.log(`Bucket "${this.bucketName}" already exists.`);
            } else {
                throw err;
            }
        }
    }

    async uploadFile(file: Express.Multer.File, userId: string): Promise<string> {
        const fileExtension = file.originalname.split(".").pop();
        const objectKey = `user-${userId}/${randomUUID()}.${fileExtension}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        });

        await this.client.send(command);
        return objectKey;
    }

    async listFilesForUser(userId: string): Promise<{ key: string; lastModified: Date }[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: `user-${userId}/`,
        });

        const response = await this.client.send(command);

        return (
            response.Contents?.map((item) => ({
                key: item.Key!,
                lastModified: item.LastModified!,
            })) || []
        );
    }

    async deleteFile(objectKey: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
        });

        await this.client.send(command);
        console.log(`File deleted: ${objectKey}`);
    }

    async getSignedDownloadUrl(objectKey: string, expiresIn: number = 60): Promise<string> {
        // temporary client for public url
        const signingClient = new S3Client({
            endpoint: this.publicUrl,
            forcePathStyle: true,
            region: this.client.config.region,
            credentials: this.client.config.credentials,
        });

        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
        });

        return await getSignedUrl(signingClient, command, { expiresIn });
    }
}

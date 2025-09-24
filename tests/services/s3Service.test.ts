import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/s3-request-presigner');

vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('@aws-sdk/client-s3')>();
    return {
        ...originalModule,
        S3Client: vi.fn(),
    };
});

import { S3Service, S3ClientConfig } from '../../src/services/s3Service';
import { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const testConfig: S3ClientConfig = {
    endpoint: 'http://test-minio',
    port: 9000,
    accessKey: 'test-key',
    secretAccessKey: 'test-secret',
    bucket: 'test-bucket',
};

const MockS3Client = vi.mocked(S3Client);
const mockSend = vi.fn(); // Das ist unser gefälschter "send"-Befehl
const mockGetSignedUrl = vi.mocked(getSignedUrl);

describe('S3Service', () => {
    let s3Service: S3Service;

    beforeEach(() => {
        vi.clearAllMocks();

        // @ts-ignore
        S3Service.instance = undefined;

        MockS3Client.mockImplementation(() => ({
            send: mockSend,
        }) as any);

        s3Service = S3Service.getInstance(testConfig);
    });

    describe('Initialization and Bucket Creation', () => {
        it('should create a singleton instance correctly', () => {
            const instance1 = S3Service.getInstance(testConfig);
            const instance2 = S3Service.getInstance(); // Ohne Config, da schon initialisiert
            expect(instance1).toBe(instance2);
            expect(MockS3Client).toHaveBeenCalledOnce();
        });

        it('should call ensureBucketExists and handle existing buckets gracefully', async () => {
            mockSend.mockRejectedValue({ name: 'BucketAlreadyOwnedByYou' });

            await expect(s3Service.ensureBucketExists()).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
        });

        it('should create a new bucket if it does not exist', async () => {
            mockSend.mockResolvedValue({});

            await expect(s3Service.ensureBucketExists()).resolves.toBeUndefined();

            expect(mockSend).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
        });
    });

    describe('uploadFile', () => {
        it('should upload a file and return the correct object key', async () => {
            const mockFile = {
                originalname: 'test-image.jpg',
                buffer: Buffer.from('test-data'),
                mimetype: 'image/jpeg',
            };

            const userId = 'user-123';

            const objectKey = await s3Service.uploadFile(mockFile, userId);

            expect(objectKey).toMatch(/^user-user-123\/[a-f0-9-]+\.jpg$/);

            expect(mockSend).toHaveBeenCalledOnce();
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));

            const sentCommand = (mockSend.mock.calls[0][0] as PutObjectCommand).input;

            expect(sentCommand.Bucket).toBe('test-bucket');
            expect(sentCommand.Key).toBe(objectKey);
            expect(sentCommand.Body).toBe(mockFile.buffer);
        });
    });

    describe('getSignedDownloadUrl', () => {
        it('should generate a signed URL for a given object key', async () => {
            const objectKey = 'user-123/image.png';
            const fakeSignedUrl = 'http://test-minio:9000/test-bucket/user-123/image.png?signed=true';

            mockGetSignedUrl.mockResolvedValue(fakeSignedUrl);

            const signedUrl = await s3Service.getSignedDownloadUrl(objectKey, 300);

            expect(signedUrl).toBe(fakeSignedUrl);

            expect(mockGetSignedUrl).toHaveBeenCalledOnce();
            expect(mockGetSignedUrl).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(GetObjectCommand),
                { expiresIn: 300 }
            );

            const passedCommand = (mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand).input;
            expect(passedCommand.Bucket).toBe('test-bucket');
            expect(passedCommand.Key).toBe(objectKey);
        });
    });
});
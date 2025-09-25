import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import request from "supertest";
import express from "express";
import {RestStorage} from "../../src/rest/restStorage";
import {S3Service} from "../../src/services/s3Service";

// @ts-ignore
import {createMockS3Service, createTestApp} from "../helpers/testSetup";

vi.mock("../../src/services/s3Service");

describe("RestStorage", () => {
    let app: express.Application;
    let mockS3Service: any;

    const requestingUserUUID = "user-id-123";

    beforeEach(() => {
        vi.clearAllMocks();

        mockS3Service = createMockS3Service();

        const restStorage = new RestStorage(mockS3Service as unknown as S3Service);

        app = createTestApp(restStorage.createRouter(), "/storage", {
            uuid: requestingUserUUID,
            name: "name",
            id: "1234"
        });

    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("POST /upload", () => {
        it("should upload a file and return a 201 Created response", async () => {
            const objectKey = `user-${requestingUserUUID}/generated-uuid.jpg`;
            mockS3Service.uploadFile.mockResolvedValue(objectKey);

            const response = await request(app) // Verwende die 'app' aus dem beforeEach
                .post("/storage/upload")
                .attach('image', Buffer.from("fake image data"), "test.jpg")
                .expect(201);

            expect(response.body.data).toEqual({
                message: "File uploaded successfully",
                objectKey: objectKey,
            });

            expect(mockS3Service.uploadFile).toHaveBeenCalledOnce();
            expect(mockS3Service.uploadFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    originalname: 'test.jpg'
                }),
                requestingUserUUID
            );
        });

        it("should return a 400 Bad Request if no file is provided", async () => {
            const response = await request(app)
                .post("/storage/upload")
                .expect(400);

            expect(response.body.data.message).toBe("No file provided.");
            expect(mockS3Service.uploadFile).not.toHaveBeenCalled();
        });
    });

    describe("GET /files", () => {
        it("should return a list of files for the current user", async () => {
            const mockFiles = [
                {key: `user-${requestingUserUUID}/file1.txt`, lastModified: new Date()},
                {key: `user-${requestingUserUUID}/image.png`, lastModified: new Date()},
            ];
            mockS3Service.listFilesForUser.mockResolvedValue(mockFiles);

            const response = await request(app)
                .get("/storage/files")
                .expect(200);

            const responseData = JSON.parse(JSON.stringify(mockFiles));
            expect(response.body.data).toEqual(responseData);
            expect(mockS3Service.listFilesForUser).toHaveBeenCalledOnce();
            expect(mockS3Service.listFilesForUser).toHaveBeenCalledWith(requestingUserUUID);
        });
    });

    describe("GET /files/:key/url", () => { // Beschreibung an die Logik angepasst
        it("should return a signed URL for a file owned by the user", async () => {
            const objectKey = `user-${requestingUserUUID}/my-photo.jpg`;
            const signedUrl = "http://s3.com/signed-url";
            mockS3Service.getSignedDownloadUrl.mockResolvedValue(signedUrl);

            const response = await request(app)
                .get(`/storage/files/${encodeURIComponent(objectKey)}/url`)
                .expect(200);

            expect(response.body.data).toEqual({url: signedUrl});
            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalledOnce();
            expect(mockS3Service.getSignedDownloadUrl).toHaveBeenCalledWith(objectKey, 60);
        });

        it("should return 403 Forbidden if the user tries to access another user's file", async () => {
            const objectKey = "user-another-user/secret.txt";

            await request(app)
                .get(`/storage/files/${encodeURIComponent(objectKey)}/url`)
                .expect(403);

            expect(mockS3Service.getSignedDownloadUrl).not.toHaveBeenCalled();
        });

        it("should return 404 Not Found if the file does not exist", async () => {
            const objectKey = `user-${requestingUserUUID}/non-existent.jpg`;
            mockS3Service.getSignedDownloadUrl.mockRejectedValue({name: "NoSuchKey"});

            const response = await request(app)
                .get(`/storage/files/${encodeURIComponent(objectKey)}/url`)
                .expect(404);

            expect(response.body.data.message).toBe("File not found.");
        });
    });

    describe("DELETE /files/:key", () => { // Beschreibung an die Logik angepasst
        it("should delete a file owned by the user", async () => {
            const objectKey = `user-${requestingUserUUID}/file-to-delete.pdf`;
            mockS3Service.deleteFile.mockResolvedValue(undefined);

            const response = await request(app)
                .delete(`/storage/files/${encodeURIComponent(objectKey)}`)
                .expect(200);

            expect(response.body.data).toBe("File deleted successfully");
            expect(mockS3Service.deleteFile).toHaveBeenCalledOnce();
            expect(mockS3Service.deleteFile).toHaveBeenCalledWith(objectKey);
        });

        it("should return 403 Forbidden if the user tries to delete another user's file", async () => {
            const objectKey = "user-another-user/data.csv";

            await request(app)
                .delete(`/storage/files/${encodeURIComponent(objectKey)}`)
                .expect(403);

            expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
        });
    });
});
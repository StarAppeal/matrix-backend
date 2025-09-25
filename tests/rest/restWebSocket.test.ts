import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { RestWebSocket } from "../../src/rest/restWebSocket";

// @ts-ignore
import { createTestApp, createMockWebSocketServer } from "../helpers/testSetup";

vi.mock("../../src/websocket", () => ({
    ExtendedWebSocketServer: vi.fn()
}));

describe("RestWebSocket", () => {
    let app: express.Application;
    let mockWebSocketServer: ReturnType<typeof createMockWebSocketServer>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWebSocketServer = createMockWebSocketServer();

        const restWebSocket = new RestWebSocket(mockWebSocketServer as any);

        app = createTestApp(restWebSocket.createRouter(), "/websocket");
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("POST /broadcast", () => {
        it("should broadcast a complex object payload", async () => {
            const payload = { type: "update", data: { a: 1 } };
            await request(app).post("/websocket/broadcast").send({ payload }).expect(200);
            expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(JSON.stringify(payload));
        });

        it("should return bad request for missing payload", async () => {
            const response = await request(app).post("/websocket/broadcast").send({}).expect(400);
            expect(response.body.data.details).toContain("payload is required");
            expect(mockWebSocketServer.broadcast).not.toHaveBeenCalled();
        });
    });

    describe("POST /send-message", () => {
        const validPayload = { type: "private_message", content: "Hello!" };

        it("should send message to specific users", async () => {
            const users = ["user1", "user2"];
            await request(app).post("/websocket/send-message").send({ payload: validPayload, users }).expect(200);
            expect(mockWebSocketServer.sendMessageToUser).toHaveBeenCalledTimes(2);
            expect(mockWebSocketServer.sendMessageToUser).toHaveBeenCalledWith("user1", JSON.stringify(validPayload));
            expect(mockWebSocketServer.sendMessageToUser).toHaveBeenCalledWith("user2", JSON.stringify(validPayload));
        });

        it("should return bad request for missing payload", async () => {
            const response = await request(app).post("/websocket/send-message").send({ users: ["user1"] }).expect(400);
            expect(response.body.data.details).toContain("payload is required");
        });

        it("should return bad request for missing users", async () => {
            const response = await request(app).post("/websocket/send-message").send({ payload: validPayload }).expect(400);
            expect(response.body.data.details).toContain("users is required");
        });

        it.each([
            { description: "an empty array", users: [] },
            { description: "a non-array value", users: "user1" },
            { description: "an array with non-strings", users: ["user1", 123] },
            { description: "an array with empty strings", users: ["user1", ""] },
            { description: "an array with whitespace-only strings", users: ["user1", "   "] },
        ])("should return bad request for users being $description", async ({ users }) => {
            const response = await request(app)
                .post("/websocket/send-message")
                .send({ payload: validPayload, users })
                .expect(400);

            expect(response.body.data.details).toContain("users must be a non-empty array of strings");
            expect(mockWebSocketServer.sendMessageToUser).not.toHaveBeenCalled();
        });
    });

    describe("GET /all-clients", () => {
        it("should return all connected clients", async () => {
            const mockClients = new Set([
                { payload: { uuid: "user1", username: "alice" } },
                { payload: { uuid: "user2", username: "bob" } },
            ]);
            mockWebSocketServer.getConnectedClients.mockReturnValue(mockClients);

            const response = await request(app).get("/websocket/all-clients").expect(200);

            expect(response.body.data.result).toEqual([
                { uuid: "user1", username: "alice" },
                { uuid: "user2", username: "bob" },
            ]);
            expect(mockWebSocketServer.getConnectedClients).toHaveBeenCalled();
        });

        it("should return an empty array when no clients are connected", async () => {
            mockWebSocketServer.getConnectedClients.mockReturnValue(new Set());
            const response = await request(app).get("/websocket/all-clients").expect(200);
            expect(response.body.data.result).toEqual([]);
        });
    });
});
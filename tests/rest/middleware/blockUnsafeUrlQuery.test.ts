import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { blockUnsafeUrlQuery } from "../../../src/rest/middleware/blockUnsafeUrlQuery";

vi.mock("dns/promises", () => ({
    lookup: vi.fn(),
}));

import { lookup } from "dns/promises";

const mockLookup = vi.mocked(lookup);

describe("blockUnsafeUrlQuery", () => {
    let app: express.Application;

    beforeEach(() => {
        vi.clearAllMocks();
        const router = express.Router();
        router.get("/check", blockUnsafeUrlQuery("url"), (_req, res) => res.status(200).send({ ok: true }));
        app = express();
        app.use("/test", router);
    });

    it("allows public http/https urls", async () => {
        mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);

        const response = await request(app)
            .get("/test/check")
            .query({ url: "https://example.com/image.png" })
            .expect(200);

        expect(response.body.ok).toBe(true);
        expect(mockLookup).toHaveBeenCalledWith("example.com", { all: true, verbatim: true });
    });

    it("blocks localhost", async () => {
        const response = await request(app)
            .get("/test/check")
            .query({ url: "http://localhost/secret" })
            .expect(400);

        expect(response.body.data.message).toBe("URL not allowed");
        expect(response.body.data.details).toBe("Localhost is not allowed");
        expect(mockLookup).not.toHaveBeenCalled();
    });

    it("blocks private IPs in the URL", async () => {
        const response = await request(app)
            .get("/test/check")
            .query({ url: "http://127.0.0.1/secret" })
            .expect(400);

        expect(response.body.data.details).toBe("Private IPs are not allowed");
        expect(mockLookup).not.toHaveBeenCalled();
    });

    it("blocks hostnames that resolve to private IPs", async () => {
        mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as any);

        const response = await request(app)
            .get("/test/check")
            .query({ url: "https://internal.example/" })
            .expect(400);

        expect(response.body.data.details).toBe("Private IPs are not allowed");
    });

    it("blocks unsupported protocols", async () => {
        const response = await request(app)
            .get("/test/check")
            .query({ url: "ftp://example.com/file" })
            .expect(400);

        expect(response.body.data.details).toBe("Unsupported URL protocol");
    });

    it("blocks when DNS lookup fails", async () => {
        mockLookup.mockRejectedValue(new Error("DNS error"));

        const response = await request(app)
            .get("/test/check")
            .query({ url: "https://example.com" })
            .expect(400);

        expect(response.body.data.details).toBe("Failed to resolve host");
    });
});


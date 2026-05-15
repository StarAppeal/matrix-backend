import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { RestAdmin } from "../../src/rest/restAdmin";
import { TamagotchiState } from "../../src/db/models/tamagotchi";

vi.mock("../../src/rest/middleware/isAdmin", () => ({
    isAdmin: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next())
}));

describe("RestAdmin Tamagotchi Routes", () => {
    let app: express.Express;
    let mockUserService: any;
    let mockJwtAuth: any;
    let mockTamagotchiService: any;
    let mockWsProvider: any;

    beforeEach(() => {
        mockUserService = {
            countUsers: vi.fn().mockResolvedValue(10),
            countDeletedUsers: vi.fn().mockResolvedValue(1),
            countAdmins: vi.fn().mockResolvedValue(2),
            getAllUsersIncludingDeleted: vi.fn().mockResolvedValue([]),
        };
        mockJwtAuth = {};
        mockTamagotchiService = {
            getAllTamagotchis: vi.fn().mockResolvedValue([
                { uuid: "uuid-1", status: TamagotchiState.IDLE_HAPPY }
            ]),
            revive: vi.fn().mockResolvedValue({ status: TamagotchiState.IDLE_HAPPY }),
            updateStats: vi.fn().mockResolvedValue({ status: TamagotchiState.SLEEPING, energy: 0 })
        };
        mockWsProvider = vi.fn().mockReturnValue({
            getConnectedClients: vi.fn().mockReturnValue(new Set())
        });

        const restAdmin = new RestAdmin(
            mockUserService,
            mockJwtAuth,
            mockTamagotchiService,
            mockWsProvider
        );

        app = express();
        app.use(express.json());
        app.use("/api/admin", restAdmin.createRouter());
    });

    it("GET /api/admin/tamagotchis should return all tamagotchis", async () => {
        const response = await request(app).get("/api/admin/tamagotchis");
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.data.tamagotchis).toHaveLength(1);
        expect(mockTamagotchiService.getAllTamagotchis).toHaveBeenCalled();
    });

    it("POST /api/admin/tamagotchis/:uuid/revive should call revive", async () => {
        const response = await request(app).post("/api/admin/tamagotchis/uuid-1/revive");
        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mockTamagotchiService.revive).toHaveBeenCalledWith("uuid-1");
    });

    it("PUT /api/admin/tamagotchis/:uuid should update stats", async () => {
        const response = await request(app)
            .put("/api/admin/tamagotchis/uuid-1")
            .send({ hunger: 100, energy: 0 });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(mockTamagotchiService.updateStats).toHaveBeenCalledWith("uuid-1", { hunger: 100, energy: 0 });
    });
});

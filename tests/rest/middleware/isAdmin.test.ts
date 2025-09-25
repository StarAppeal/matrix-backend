import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { Request, Response, NextFunction } from "express";
import { isAdmin } from "../../../src/rest/middleware/isAdmin";
// @ts-ignore
import { createMockUserService } from "../../helpers/testSetup";
import { notFound } from "../../../src/rest/utils/responses";

vi.mock("../../../src/db/services/db/UserService", () => ({
    UserService: {
        create: vi.fn(),
    },
}));

vi.mock("../../../src/rest/utils/responses", () => ({
    notFound: vi.fn(),
}));

describe("isAdmin middleware", () => {
    let mockedUserService: any;
    let req: Partial<Request>;
    let res: Mocked<Response>;
    let next: Mocked<NextFunction>;

    const uuid = "abcd-coffe";

    beforeEach(() => {
        vi.clearAllMocks();

        mockedUserService = createMockUserService();

        req = {
            // @ts-ignore
            payload: { uuid, username: "username", id: ""}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        } as unknown as Mocked<Response>;

        next = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Success Scenarios", () => {
        it("should call next() if user is an admin", async () => {
            const mockUser = { uuid, config: { isAdmin: true } };
            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            await isAdmin(mockedUserService)(req as Request, res, next);

            expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(uuid);
            expect(next).toHaveBeenCalledOnce();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.send).not.toHaveBeenCalled();
            expect(notFound).not.toHaveBeenCalled();
        });
    });

    describe("Failure Scenarios", () => {
        it("should call notFound if user is not an admin", async () => {
            const mockUser = { uuid, config: { isAdmin: false } };
            mockedUserService.getUserByUUID.mockResolvedValue(mockUser);

            await isAdmin(mockedUserService)(req as Request, res, next);

            expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(uuid);
            expect(notFound).toHaveBeenCalledWith(res);
            expect(next).not.toHaveBeenCalled();
        });

        it("should call notFound if user does not exist", async () => {
            mockedUserService.getUserByUUID.mockResolvedValue(null);

            await isAdmin(mockedUserService)(req as Request, res, next);

            expect(mockedUserService.getUserByUUID).toHaveBeenCalledWith(uuid);
            expect(notFound).toHaveBeenCalledWith(res);
            expect(next).not.toHaveBeenCalled();
        });

        it("should handle errors during user fetching", async () => {
            const dbError = new Error("Database error");
            mockedUserService.getUserByUUID.mockRejectedValue(dbError);

            await isAdmin(mockedUserService)(req as Request, res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Database error' }));
        });
    });
});
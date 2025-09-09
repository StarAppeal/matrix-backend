import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../src/rest/middleware/asyncHandler";

describe("asyncHandler", () => {
    let mockReq: Mocked<Request>;
    let mockRes: Mocked<Response>;
    let mockNext: Mocked<NextFunction>;

    beforeEach(() => {
        mockReq = {} as Mocked<Request>;
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        } as unknown as Mocked<Response>;
        mockNext = vi.fn();
    });

    describe("Success Scenarios", () => {
        it("should call the wrapped function with all parameters and not call next on success", async () => {
            const mockAsyncFn = vi.fn().mockResolvedValue("success");
            const wrappedHandler = asyncHandler(mockAsyncFn);

            await wrappedHandler(mockReq, mockRes, mockNext);

            expect(mockAsyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should handle functions that return non-promise values correctly", async () => {
            const mockSyncFn = vi.fn().mockReturnValue("immediate success");
            const wrappedHandler = asyncHandler(mockSyncFn);

            await wrappedHandler(mockReq, mockRes, mockNext);

            expect(mockSyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe("Error Scenarios", () => {
        it.each([
            {
                description: "a rejected promise with an Error object",
                error: new Error("Test error"),
                setup: (fn: Mocked<any>) => fn.mockRejectedValue(new Error("Test error")),
            },
            {
                description: "a synchronously thrown Error",
                error: new Error("Sync error"),
                setup: (fn: Mocked<any>) => fn.mockImplementation(() => { throw new Error("Sync error"); }),
            },
            {
                description: "a rejected promise with a string",
                error: "String error",
                setup: (fn: Mocked<any>) => fn.mockRejectedValue("String error"),
            },
            {
                description: "a rejected promise with null",
                error: null,
                setup: (fn: Mocked<any>) => fn.mockRejectedValue(null),
            },
        ])("should call next with the error when the function fails with $description", async ({ error, setup }) => {
            const mockFailingFn = vi.fn();
            setup(mockFailingFn);

            const wrappedHandler = asyncHandler(mockFailingFn);
            await wrappedHandler(mockReq, mockRes, mockNext);

            expect(mockFailingFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});
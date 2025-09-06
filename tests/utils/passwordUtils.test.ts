import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { hashMock, compareMock } = vi.hoisted(() => ({
    hashMock: vi.fn(),
    compareMock: vi.fn(),
}));


vi.mock("bcrypt", () => {
    return {
        hash: hashMock,
        compare: compareMock,
        default: {
            hash: hashMock,
            compare: compareMock,
        },
    };
});


import { PasswordUtils } from "../../src/utils/passwordUtils";

describe("PasswordUtils", () => {
    beforeEach(() => {
        hashMock.mockReset();
        compareMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("hashPassword uses bcrypt.hash with 10 saltrounds", async () => {
        hashMock.mockResolvedValue("hashed");
        const res = await PasswordUtils.hashPassword("secret");
        expect(hashMock).toHaveBeenCalledWith("secret", 10);
        expect(res).toBe("hashed");
    });

    it("comparePassword uses bcrypt.compare", async () => {
        compareMock.mockResolvedValue(true);
        const ok = await PasswordUtils.comparePassword("secret", "hashed");
        expect(compareMock).toHaveBeenCalledWith("secret", "hashed");
        expect(ok).toBe(true);
    });

    describe("validatePassword", () => {
        it("fails when password too short", () => {
            const res = PasswordUtils.validatePassword("A1!");
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/mindestens 8 Zeichen/);
        });

        it("fails without capital letter", () => {
            const res = PasswordUtils.validatePassword("password1!");
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/Großbuchstaben/);
        });

        it("fails without uncapitalized letter", () => {
            const res = PasswordUtils.validatePassword("PASSWORD1!");
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/Kleinbuchstaben/);
        });

        it("fails without number", () => {
            const res = PasswordUtils.validatePassword("Password!");
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/Zahl/);
        });

        it("fails without special characters", () => {
            const res = PasswordUtils.validatePassword("Password1");
            expect(res.valid).toBe(false);
            expect(res.message).toMatch(/Sonderzeichen/);
        });

        it("accepts valid password", () => {
            const res = PasswordUtils.validatePassword("ValidPassword1!");
            expect(res.valid).toBe(true);
        });
    });
});
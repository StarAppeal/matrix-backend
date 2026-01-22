import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { PasswordUtils, ValidationResult } from "../../src/utils/passwordUtils";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

const mockedBcrypt = vi.mocked(bcrypt);

describe("PasswordUtils", () => {
  describe("hashPassword", () => {
    it("should hash password with salt rounds of 10", async () => {
      const password = "testPassword123!";
      const hashedPassword = "hashedPassword123";

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as any);

      const result = await PasswordUtils.hashPassword(password);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it("should handle bcrypt errors", async () => {
      const password = "testPassword123!";
      const error = new Error("Bcrypt error");

      mockedBcrypt.hash.mockRejectedValue(error);

      await expect(PasswordUtils.hashPassword(password)).rejects.toThrow("Bcrypt error");
    });
  });

  describe("comparePassword", () => {
    it("should return true for matching passwords", async () => {
      const password = "testPassword123!";
      const hashedPassword = "hashedPassword123";

      mockedBcrypt.compare.mockResolvedValue(true as any);

      const result = await PasswordUtils.comparePassword(password, hashedPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it("should return false for non-matching passwords", async () => {
      const password = "testPassword123!";
      const hashedPassword = "hashedPassword123";

      mockedBcrypt.compare.mockResolvedValue(false as any);

      const result = await PasswordUtils.comparePassword(password, hashedPassword);

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(false);
    });

    it("should handle bcrypt comparison errors", async () => {
      const password = "testPassword123!";
      const hashedPassword = "hashedPassword123";
      const error = new Error("Bcrypt comparison error");

      mockedBcrypt.compare.mockRejectedValue(error);

      await expect(PasswordUtils.comparePassword(password, hashedPassword)).rejects.toThrow("Bcrypt comparison error");
    });
  });

  describe("validatePassword", () => {
    it("should return valid for a strong password", () => {
      const password = "StrongPass123!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(true);
      expect(result.message).toBe("Passwort ist gültig.");
    });

    it("should reject password shorter than 8 characters", () => {
      const password = "Short1!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Passwort muss mindestens 8 Zeichen lang sein.");
    });

    it("should reject password without uppercase letter", () => {
      const password = "lowercase123!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Passwort muss mindestens einen Großbuchstaben enthalten.");
    });

    it("should reject password without lowercase letter", () => {
      const password = "UPPERCASE123!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Passwort muss mindestens einen Kleinbuchstaben enthalten.");
    });

    it("should reject password without number", () => {
      const password = "NoNumbers!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Passwort muss mindestens eine Zahl enthalten.");
    });

    it("should reject password without special character", () => {
      const password = "NoSpecialChar123";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Passwort muss mindestens ein Sonderzeichen enthalten.");
    });

    it("should accept all valid special characters", () => {
      const specialChars = "!@#$%^&*(),.?\":{}|<>";

      for (const char of specialChars) {
        const password = `ValidPass123${char}`;
        const result: ValidationResult = PasswordUtils.validatePassword(password);

        expect(result.valid).toBe(true);
        expect(result.message).toBe("Passwort ist gültig.");
      }
    });

    it("should handle edge case with exactly 8 characters", () => {
      const password = "Valid12!";

      const result: ValidationResult = PasswordUtils.validatePassword(password);

      expect(result.valid).toBe(true);
      expect(result.message).toBe("Passwort ist gültig.");
    });
  });
});
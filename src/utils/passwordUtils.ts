import bcrypt from "bcryptjs";

export type ValidationResult = {
    valid: boolean;
    message?: string;
};

export class PasswordUtils {
    private constructor() {}

    public static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 10);
    }

    public static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }

    public static validatePassword(password: string): ValidationResult {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return { valid: false, message: `Passwort muss mindestens ${minLength} Zeichen lang sein.` };
        }

        if (!hasUpperCase) {
            return { valid: false, message: "Passwort muss mindestens einen Großbuchstaben enthalten." };
        }

        if (!hasLowerCase) {
            return { valid: false, message: "Passwort muss mindestens einen Kleinbuchstaben enthalten." };
        }

        if (!hasNumber) {
            return { valid: false, message: "Passwort muss mindestens eine Zahl enthalten." };
        }

        if (!hasSpecialChar) {
            return { valid: false, message: "Passwort muss mindestens ein Sonderzeichen enthalten." };
        }

        return { valid: true, message: "Passwort ist gültig." };
    }
}

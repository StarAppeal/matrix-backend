type NodeEnv = "development" | "test" | "production";

interface BaseConfig {
    env: NodeEnv;
    port: number;
    cors: {
        origin: string;
        credentials: boolean;
    };
}

function required(name: string, value: string | undefined): string {
    if (!value || value.trim() === "") {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

function optionalNumber(name: string, value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Env var ${name} must be a positive number`);
    }
    return n;
}

function optionalString(name: string, value: string | undefined, fallback: string): string {
    return value ?? fallback;
}

function isValidUrl(u: string): boolean {
    try {
        new URL(u);
        return true;
    } catch {
        return false;
    }
}

const NODE_ENV = (optionalString("NODE_ENV", process.env.NODE_ENV, "development") as NodeEnv);
const PORT = optionalNumber("PORT", process.env.PORT, 3000);

const FRONTEND_URL = required("FRONTEND_URL", process.env.FRONTEND_URL);
if (!isValidUrl(FRONTEND_URL)) {
    throw new Error("FRONTEND_URL must be a valid URL");
}

export const config :BaseConfig = {
    env: NODE_ENV,
    port: PORT,
    cors: {
        origin: FRONTEND_URL,
        credentials: true,
    },
};

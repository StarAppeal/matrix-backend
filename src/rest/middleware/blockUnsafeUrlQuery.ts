import type { Request, Response, NextFunction } from "express";
import net from "net";
import { lookup } from "dns/promises";
import { badRequest } from "../utils/responses";

const isPrivateIp = (host: string): boolean => {
    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
        const parts = host.split(".").map((part) => Number(part));
        if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
        if (parts[0] === 10) return true;
        if (parts[0] === 127) return true;
        if (parts[0] === 0) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        return parts[0] === 192 && parts[1] === 168;

    }
    if (ipVersion === 6) {
        const normalized = host.toLowerCase();
        if (normalized === "::1") return true;
        if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
        if (normalized.startsWith("fe80")) return true;
        return normalized.startsWith("::ffff:127.");

    }
    return false;
};

const getBlockedUrlReason = async (url: string): Promise<string | null> => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return "Invalid URL";
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "Unsupported URL protocol";
    }

    const host = parsed.hostname.toLowerCase();
    if (host === "localhost") return "Localhost is not allowed";
    if (isPrivateIp(host)) return "Private IPs are not allowed";

    try {
        const resolved = await lookup(host, { all: true, verbatim: true });
        if (!resolved.length) return "Failed to resolve host";
        if (resolved.some((entry) => isPrivateIp(entry.address))) {
            return "Private IPs are not allowed";
        }
    } catch {
        return "Failed to resolve host";
    }

    return null;
};

export function blockUnsafeUrlQuery(paramName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const value = req.query[paramName];
        if (typeof value !== "string") {
            return badRequest(res, "URL not allowed", "URL must be a string");
        }

        const blockedReason = await getBlockedUrlReason(value);
        if (blockedReason) {
            return badRequest(res, "URL not allowed", blockedReason);
        }

        next();
    };
}


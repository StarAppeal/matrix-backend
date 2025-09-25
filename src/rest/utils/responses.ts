import type { Response } from "express";

type ErrorDetails = unknown;

function respondError(res: Response, status: number, message: string, details?: ErrorDetails) {
    return res.status(status).send({
        ok: false,
        data: {
            message,
            details,
        },
    });
}

export function ok<T>(res: Response, data: T) {
    return res.status(200).send({ ok: true, data });
}

export function created<T>(res: Response, data: T) {
    return res.status(201).send({ ok: true, data });
}

export function badRequest(res: Response, message = "Bad Request", details?: ErrorDetails) {
    return respondError(res, 400, message, details);
}

export function unauthorized(res: Response, message = "Unauthorized", details?: ErrorDetails) {
    return respondError(res, 401, message, details);
}

export function forbidden(res: Response, message = "Forbidden", details?: ErrorDetails) {
    return respondError(res, 403, message, details);
}

export function notFound(res: Response, message = "Not Found", details?: ErrorDetails) {
    return respondError(res, 404, message, details);
}

export function conflict(res: Response, message = "Conflict", details?: ErrorDetails) {
    return respondError(res, 409, message, details);
}

export function tooManyRequests(res: Response, message = "Too Many Requests", details?: ErrorDetails) {
    return respondError(res, 429, message, details);
}

export function internalError(res: Response, message = "Internal Server Error", details?: ErrorDetails) {
    return respondError(res, 500, message, details);
}

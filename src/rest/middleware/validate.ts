import type { Request, Response, NextFunction } from "express";
import { badRequest } from "../utils/responses";

/**
 * A type definition for a validation function.
 * The `Validator` function type accepts a single argument `value`
 * of any type and returns either `true` if the validation is successful
 * or a `string` containing an error message if the validation fails.
 */
type Validator = (value: unknown) => true | string;

/**
 * A collection of validation functions for validating various data types.
 *
 * @property {function(opts?: { nonEmpty?: boolean; max?: number; min?: number }): Validator} isString
 * Validates whether a value is a string. Additional options can be provided:
 * - `nonEmpty`: Ensures the string is not empty when set to `true`.
 * - `max`: Specifies the maximum allowed string length.
 * - `min`: Specifies the minimum required string length.
 *
 * @property {function(opts?: { min?: number; max?: number; integer?: boolean }): Validator} isNumber
 * Validates whether a value is a number. Additional options can be provided:
 * - `min`: Specifies the minimum allowed value.
 * - `max`: Specifies the maximum allowed value.
 * - `integer`: Ensures the value is an integer when set to `true`.
 *
 * @property {function(): Validator} isBoolean
 * Validates whether a value is a boolean.
 *
 * @property {function<T extends readonly string[]>(values: T): Validator} isEnum
 * Validates whether a value matches one of the provided allowed values in the enum.
 * - `values`: An array of valid string options to check against.
 *
 * @property {function(len: number): Validator} isArrayLength
 * Validates whether an array has the exact specified length.
 * - `len`: The required array length.
 *
 * @property {function(): Validator} isUrl
 * Validates whether a value is a valid URL. The value must be a string and conform to standard URL formatting rules.
 */
export const v = {
    isString: (opts?: { nonEmpty?: boolean; max?: number; min?: number }): Validator => {
        return (value: unknown) => {
            if (typeof value !== "string") return "must be a string";
            if (opts?.nonEmpty && value.trim().length === 0) return "must be a non-empty string";
            if (opts?.max !== undefined && value.length > opts.max) return `must be at most ${opts.max} chars`;
            if (opts?.min !== undefined && value.length < opts.min) return `must be at least ${opts.min} chars`;
            return true;
        };
    },
    isNumber: (opts?: { min?: number; max?: number; integer?: boolean }): Validator => {
        return (value: unknown) => {
            if (typeof value !== "number" || Number.isNaN(value)) return "must be a number";
            if (opts?.integer && !Number.isInteger(value)) return "must be an integer";
            if (opts?.min !== undefined && value < opts.min) return `must be >= ${opts.min}`;
            if (opts?.max !== undefined && value > opts.max) return `must be <= ${opts.max}`;
            return true;
        };
    },
    isBoolean: (): Validator => {
        return (value: unknown) => (typeof value === "boolean" ? true : "must be a boolean");
    },
    isEnum: <T extends readonly string[]>(values: T): Validator => {
        return (value: unknown) =>
            typeof value === "string" && values.includes(value) ? true : `must be one of: ${values.join(", ")}`;
    },
    isArrayLength: (len: number): Validator => {
        return (value: unknown) =>
            Array.isArray(value) && value.length === len ? true : `must be an array of length ${len}`;
    },
    isObject: (opts?: { nonEmpty?: boolean }): Validator => {
        return (value: unknown) => {
            if (typeof value !== "object" || value === null) return "must be an object";
            if (opts?.nonEmpty && Object.keys(value).length === 0) return "must be a non-empty object";
            return true;
        };
    },
    isUrl: (): Validator => {
        return (value: unknown) => {
            if (typeof value !== "string") return "must be a string URL";
            try {
                new URL(value);
                return true;
            } catch {
                return "must be a valid URL";
            }
        };
    },
};

/**
 * Represents a schema definition for validating objects.
 *
 * Each key in the schema corresponds to a property name in the target object,
 * with its value defining the validation rules for that property.
 *
 * @typedef {Object} Schema
 * @property {boolean} [required] - Specifies if the property is mandatory in the target object.
 * @property {Validator} validator - A function or object that validates the value of the property.
 */
type Schema = Record<string, { required?: boolean; validator: Validator }>;

/**
 * Validates a given source object against a specified schema and returns an array of error messages.
 *
 * @param {any} source - The object to be validated.
 * @param {Schema} schema - The schema containing validation rules for each property.
 * @return {string[]} An array of error messages. If there are no validation errors, the array will be empty.
 */
function validate(source: Record<string, unknown>, schema: Schema): string[] {
    const errors: string[] = [];
    for (const [key, rule] of Object.entries(schema)) {
        const value = source?.[key];
        if (value === undefined || value === null) {
            if (rule.required) errors.push(`${key} is required`);
            continue;
        }
        const res = rule.validator(value);
        if (res !== true) errors.push(`${key} ${res}`);
    }
    return errors;
}

/**
 * Middleware to validate the request body against a specified schema.
 *
 * @param {Schema} schema The schema against which the request body will be validated.
 * @return {Function} Express middleware function that validates the request body and invokes the next middleware if valid; otherwise, it responds with a 400 status and validation errors.
 */
export function validateBody(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const errs = validate(req.body, schema);
        if (errs.length) return badRequest(res, "Validation failed", errs);
        next();
    };
}

/**
 * Middleware to validate the request parameters against the provided schema.
 *
 * @param {Schema} schema - The validation schema to check the request parameters.
 * @return {(req: Request, res: Response, next: NextFunction) => void} A middleware function that validates the request parameters.
 */
export function validateParams(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const errs = validate(req.params, schema);
        if (errs.length) return res.status(400).send({ error: "Validation failed", details: errs });
        next();
    };
}

/**
 * Middleware function to validate the query parameters of a request against a predefined schema.
 *
 * @param {Schema} schema - The validation schema used to validate the query parameters.
 * @return {Function} Middleware function that validates the query parameters and either sends a 400 response with validation errors or proceeds to the next middleware.
 */
export function validateQuery(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const errs = validate(req.query, schema);
        if (errs.length) return res.status(400).send({ error: "Validation failed", details: errs });
        next();
    };
}

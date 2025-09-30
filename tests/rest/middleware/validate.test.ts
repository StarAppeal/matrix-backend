import { describe, it, expect, vi } from "vitest";
import { v, validateBody, validateParams, validateQuery } from "../../../src/rest/middleware/validate";
import { Types } from "mongoose";

describe("v.isString", () => {
  it("accepts a simple string", () => {
    const res = v.isString()("abc");
    expect(res).toBe(true);
  });

  it("rejects non strings", () => {
    const res = v.isString()(123 as any);
    expect(res).toBe("must be a string");
  });

  it("forces nonEmpty", () => {
    const res = v.isString({ nonEmpty: true })("   ");
    expect(res).toBe("must be a non-empty string");
  });

  it("checks min/max length", () => {
    expect(v.isString({ min: 3 })("ab")).toBe("must be at least 3 chars");
    expect(v.isString({ max: 3 })("abcd")).toBe("must be at most 3 chars");
    expect(v.isString({ min: 2, max: 4 })("abc")).toBe(true);
  });
});

describe("v.isNumber", () => {
  it("accepts numbers, rejects NaN", () => {
    expect(v.isNumber()(10)).toBe(true);
    expect(v.isNumber()(Number.NaN)).toBe("must be a number");
    expect(v.isNumber()("10")).toBe("must be a number");
  });

  it("checks integer min/max", () => {
    expect(v.isNumber({ integer: true })(1.2)).toBe("must be an integer");
    expect(v.isNumber({ min: 5 })(4)).toBe("must be >= 5");
    expect(v.isNumber({ max: 5 })(6)).toBe("must be <= 5");
    expect(v.isNumber({ integer: true, min: 0, max: 10 })(10)).toBe(true);
  });
});

describe("v.isBoolean", () => {
  it("accepts true/false", () => {
    expect(v.isBoolean()(true)).toBe(true);
    expect(v.isBoolean()(false)).toBe(true);
  });

  it("rejects other types", () => {
    expect(v.isBoolean()("true" )).toBe("must be a boolean");
    expect(v.isBoolean()(0)).toBe("must be a boolean");
  });
});

describe("v.isEnum", () => {
  it("accepts only correct values", () => {
    const validator = v.isEnum(["A", "B", "C"] as const);
    expect(validator("A")).toBe(true);
    expect(validator("D")).toBe("must be one of: A, B, C");
  });
});

describe("v.isArrayLength", () => {
  it("checks the exact length", () => {
    expect(v.isArrayLength(2)([1, 2])).toBe(true);
    expect(v.isArrayLength(2)([1])).toBe("must be an array of length 2");
    expect(v.isArrayLength(2)("not array")).toBe("must be an array of length 2");
  });
});

describe("v.isObject", () => {
    it("accepts objects", () => {
        expect(v.isObject()({})).toBe(true);
        expect(v.isObject()({ a: 1 })).toBe(true);
        expect(v.isObject()("not object")).toBe("must be an object");
    });

    it("forces nonEmpty", () => {
        expect(v.isObject({ nonEmpty: true })({})).toBe("must be a non-empty object");
        expect(v.isObject({ nonEmpty: true })({ a: 1 })).toBe(true);
    });
});

describe("v.isUrl", () => {
  it("accepts valid urls", () => {
    expect(v.isUrl()("https://example.com")).toBe(true);
  });

  it("rejects invalid URLs and nom-strings", () => {
    expect(v.isUrl()("notaurl")).toBe("must be a valid URL");
    expect(v.isUrl()(123 as any)).toBe("must be a string URL");
  });
});

describe("v.isObjectId", () => {
    it("accepts valid ObjectIds", () => {
        expect(v.isObjectId()(new Types.ObjectId().toString())).toBe(true);
    });

    it("rejects invalid ObjectIds and non-strings", () => {
        expect(v.isObjectId()("invalidobjectid")).toBe("must be a valid ObjectId");
        expect(v.isObjectId()(123 as any)).toBe("must be a valid ObjectId");
    });

});

describe("validateBody Middleware", () => {
  const schema = {
    name: { required: true, validator: v.isString({ nonEmpty: true }) },
    age: { required: false, validator: v.isNumber({ min: 0, integer: true }) },
  };

  function makeRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    return res;
  }

  it("calls next(), when valid", async () => {
    const req: any = { body: { name: "Alice", age: 30 } };
    const res = makeRes();
    const next = vi.fn();

    const mw = validateBody(schema);
    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it("sends 400 with missing/incorrect fields", async () => {
    const req: any = { body: { name: "   ", age: -1 } };
    const res = makeRes();
    const next = vi.fn();

    const mw = validateBody(schema);
    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
          ok: false,
          data: {
              message: "Validation failed",
              details: expect.arrayContaining([
                  "name must be a non-empty string",
                  "age must be >= 0",
              ]),
          }
      })
    );
  });

  it("correctly checks missing fields", async () => {
    const req: any = { body: { /* no name */ } };
    const res = makeRes();
    const next = vi.fn();

    const mw = validateBody(schema);
    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
          ok: false,
          data: {
              message: "Validation failed",
              details: expect.arrayContaining(["name is required"]),
          }
      })
    );
  });
});

describe("validateParams and validateQuery middleware", () => {
  const paramSchema = {
    id: { required: true, validator: v.isString({ nonEmpty: true }) },
  };
  const querySchema = {
    limit: { required: false, validator: v.isNumber({ integer: true, min: 1, max: 100 }) },
  };

  function makeRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    return res;
  }

  it("validateParams: ok -> next()", () => {
    const req: any = { params: { id: "abc" } };
    const res = makeRes();
    const next = vi.fn();

    validateParams(paramSchema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("validateParams: error -> 400", () => {
    const req: any = { params: { id: "   " } };
    const res = makeRes();
    const next = vi.fn();

    validateParams(paramSchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalled();
  });

  it("validateQuery: ok without limit", () => {
    const req: any = { query: { } };
    const res = makeRes();
    const next = vi.fn();

    validateQuery(querySchema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("validateQuery: error on limit outside range", () => {
    const req: any = { query: { limit: 101 } };
    const res = makeRes();
    const next = vi.fn();

    validateQuery(querySchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
        details: expect.arrayContaining(["limit must be <= 100"]),
      })
    );
  });
});

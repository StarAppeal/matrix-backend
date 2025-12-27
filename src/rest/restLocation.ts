import express from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { validateLocation } from "../services/owmApiService";
import { v, validateQuery } from "./middleware/validate";
import { ok } from "./utils/responses";

export class RestLocation {

    public createRouter() {
        const router = express.Router();

        router.get(
            "/search",
            validateQuery({
                q: { required: true, validator: v.isString({ nonEmpty: true }) },
            }),
            asyncHandler(async (_req, res) => {
                const query = _req.query.q as string;
                const locations = await validateLocation(query);
                return ok(res, { locations });
            })
        );

        return router;
    }
}

import express from "express";
import {SpotifyTokenService} from "../db/services/spotifyTokenService";
import {asyncHandler} from "./middleware/asyncHandler";
import {validateBody, v} from "./middleware/validate";
import {ok, internalError} from "./utils/responses";

export class SpotifyTokenGenerator {

    constructor(private spotifyTokenService: SpotifyTokenService) {
    }

    public createRouter() {
        const router = express.Router();

        router.post(
            "/token/refresh",
            validateBody({
                refreshToken: {required: true, validator: v.isString({nonEmpty: true})},
            }),
            asyncHandler(async (req, res) => {
                const {refreshToken} = req.body as { refreshToken: string };

                const token = await this.spotifyTokenService.refreshToken(refreshToken);

                return ok(res, {token});
            })
        );

        router.post(
            "/token/generate",
            validateBody({
                authCode: {required: true, validator: v.isString({nonEmpty: true})},
                redirectUri: {required: true, validator: v.isUrl()},
            }),
            asyncHandler(async (req, res) => {
                const {authCode, redirectUri} = req.body as { authCode: string; redirectUri: string };

                const token = await this.spotifyTokenService.generateToken(authCode, redirectUri);

                return ok(res, {token});
            })
        );

        router.use((err: any, _req: any, res: any, _next: any) => {
            return internalError(res, "Failed to handle spotify token request");
        });

        return router;
    }
}
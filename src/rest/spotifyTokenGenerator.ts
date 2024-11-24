import express from "express";
import {SpotifyTokenService} from "../db/services/spotifyTokenService";

export class SpotifyTokenGenerator {

    public createRouter() {
        const router = express.Router();

        router.get("/token/refresh/:refresh_token", async (req, res) => {
            const refreshToken = req.params.refresh_token;

            const token = await new SpotifyTokenService().refreshToken(refreshToken);

            res.status(200).send({token});
        });

        router.get(
            "/token/generate/code/:auth_code/redirect-uri/:redirect_uri",
            async (req, res) => {
                const authCode = req.params.auth_code;
                const redirectUri = req.params.redirect_uri;

                const token = await new SpotifyTokenService().generateToken(
                    authCode,
                    redirectUri,
                );

                res.status(200).send({token});
            },
        );

        return router;
    }
}

import { UserService } from "../db/services/database.service";
import express from "express";
import { SpotifyTokenService } from "../utils/spotifyTokenService";

export class SpotifyTokenGenerator {
  constructor(private callback: () => Promise<UserService>) {}

  public createRouter() {
    const router = express.Router();

    router.get("/refresh-token", async (req, res) => {
      const userService = await this.callback();

      const user = await userService.getUserById(req.payload._id);
      const spotifyConfig = user.spotifyConfig;
      const token = await new SpotifyTokenService().refreshToke(
        spotifyConfig.refreshToken,
      );
      spotifyConfig.accessToken = token.accessToken;
      spotifyConfig.expirationDate = new Date(
        Date.now() + token.expiresIn * 1000,
      );
      user.spotifyConfig = spotifyConfig;
      await userService.updateUser(req.payload._id, user);

      res.status(200).send({ result: spotifyConfig });
    });

    router.get(
      "/token/generate/code/:auth_code/redirect-uri/:redirect_uri",
      async (req, res) => {
        const userService = await this.callback();
        const authCode = req.params.auth_code;
        const redirectUri = req.params.redirect_uri;

        const user = await userService.getUserById(req.payload._id);
        const token = await new SpotifyTokenService().generateToken(
          authCode,
          redirectUri,
        );

        console.log(token);

        user.spotifyConfig = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expirationDate: new Date(Date.now() + token.expires_in * 1000),
        };

        await userService.updateUser(req.payload._id, user);
        res.status(200).send({ tokenResponse: token });
      },
    );

    return router;
  }
}

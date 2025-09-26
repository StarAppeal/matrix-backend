import axios from "axios";
import { OAuthTokenResponse } from "../interfaces/OAuthTokenResponse";
import logger from "../utils/logger";

const url = "https://accounts.spotify.com/api/token";

export class SpotifyTokenService {
    constructor(
        private readonly clientId: string,
        private readonly clientSecret: string
    ) {}

    public async refreshToken(refreshToken: string) {
        logger.debug("Refreshing Spotify token");
        const response = await axios.post(url, `grant_type=refresh_token&refresh_token=${refreshToken}`, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
            },
        });

        return response.data as OAuthTokenResponse;
    }

    public async generateToken(authorizationCode: string, redirectUri: string) {
        logger.debug("Generating new Spotify token");
        const response = await axios.post(
            url,
            `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
                },
            }
        );

        logger.debug("Received Spotify token response", { data: response.data });

        return response.data as OAuthTokenResponse;
    }
}

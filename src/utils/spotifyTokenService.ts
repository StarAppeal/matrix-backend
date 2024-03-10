import axios from "axios";
import {OAuthTokenResponse} from "../interfaces/OAuthTokenResponse";

const url = "https://accounts.spotify.com/api/token";
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

export class SpotifyTokenService {
    public async refreshToke(refreshToken: string) {
        const response = await axios.post(
            url,
            `grant_type=refresh_token&refresh_token=${refreshToken}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${Buffer.from(
                        `${clientId}:${clientSecret}`,
                    ).toString("base64")}`,
                },
            },
        );

        const token = response.data as OAuthTokenResponse;
        return {accessToken: token.access_token, expiresIn: token.expires_in};
    }

    public async generateToken(authorizationCode: string, redirectUri: string) {
        const response = await axios.post(
            url,
            `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${Buffer.from(
                        `${clientId}:${clientSecret}`,
                    ).toString("base64")}`,
                },
            },
        );

        console.log(response.data);

        return response.data as OAuthTokenResponse;
    }
}

import axios from "axios";
import {OAuthTokenResponse} from "../../interfaces/OAuthTokenResponse";

const url = "https://accounts.spotify.com/api/token";

export class SpotifyTokenService {
    constructor(private readonly clientId: string, private readonly clientSecret: string) {
    }

    public async refreshToken(refreshToken: string) {
        console.log("refreshToken")
        const response = await axios.post(
            url,
            `grant_type=refresh_token&refresh_token=${refreshToken}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${Buffer.from(
                        `${this.clientId}:${this.clientSecret}`,
                    ).toString("base64")}`,
                },
            },
        );

        return response.data as OAuthTokenResponse;
    }

    public async generateToken(authorizationCode: string, redirectUri: string) {
        console.log("generateToken")
        const response = await axios.post(
            url,
            `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${redirectUri}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${Buffer.from(
                        `${this.clientId}:${this.clientSecret}`,
                    ).toString("base64")}`,
                },
            },
        );

        console.log(response.data);

        return response.data as OAuthTokenResponse;
    }
}

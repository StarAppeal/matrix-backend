import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {SpotifyTokenService} from "../../../db/services/spotifyTokenService";
import {UserService} from "../../../db/services/db/UserService";
import {getCurrentlyPlaying} from "../../../db/services/spotifyApiService";

export class GetSpotifyUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.GET_SPOTIFY_UPDATES;

    handler = async () => {
        console.log("Starting Spotify updates");
        // first execute the function once
        this.spotifyUpdates()
            .then(() => {
                // then set the interval
                this.ws.asyncUpdates = setInterval(() => {
                    this.spotifyUpdates();
                }, 1000);
            });
    }

    private async spotifyUpdates() {
        console.log("Checking Spotify")
        const user = this.ws.user;
        const spotifyConfig = user.spotifyConfig;
        if (!spotifyConfig) {
            console.log("No Spotify config found");
            // stop the interval
            this.ws.emit(WebsocketEventType.STOP_SPOTIFY_UPDATES, {});
            return;
        }
        if (Date.now() > spotifyConfig.expirationDate.getTime()) {
            console.log("Token expired");

            const token = await new SpotifyTokenService().refreshToken(spotifyConfig.refreshToken);
            user.spotifyConfig = {
                // use old refresh token because you don't get a new one
                refreshToken: user.spotifyConfig!.refreshToken,
                accessToken: token.access_token,
                expirationDate: new Date(Date.now() + token.expires_in * 1000),
                scope: token.scope,
            };
            const userService = await UserService.create();
            await userService.updateUser(user);
            console.log("Token refreshed and database updated");
        }
        const musicData = await getCurrentlyPlaying(user.spotifyConfig!.accessToken);

        this.ws.send(JSON.stringify({
            type: "SPOTIFY_UPDATE",
            payload: musicData,
        }), {binary: false});
    }

}


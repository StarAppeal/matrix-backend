import {ExtendedWebSocket} from "../../interfaces/extendedWebsocket";
import {getCurrentlyPlaying} from "../../db/services/spotifyApiService";
import {SpotifyTokenService} from "../../db/services/spotifyTokenService";
import {UserService} from "../../db/services/db/UserService";

export class WebsocketEventHandler {
    constructor(private webSocket: ExtendedWebSocket) {
    }

    public enableErrorEvent() {
        this.webSocket.on("error", console.error);
    }

    //needed for the heartbeat mechanism
    public enablePongEvent() {
        this.webSocket.on("pong", () => {
            this.webSocket.isAlive = true;
            console.log("Pong received");
        });
    }

    public enableDisconnectEvent(callback: () => void) {
        this.webSocket.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason, event.wasClean, event.type);
            console.log(`User: ${this.webSocket.payload.name} disconnected`);
            clearInterval(this.webSocket.spotifyUpdate);
            callback();
        };
    }

    public enableMessageEvent() {
        this.webSocket.on("message", (data) => {
                const message = data.toString();
                console.log("Received message:", message);

                if (message === "GET_STATE") {
                    const messageToSend = {
                        type: "STATE",
                        payload: this.webSocket.user.lastState,
                    };
                    this.webSocket.send(JSON.stringify(messageToSend), {binary: false});
                }

                if (message === "GET_SPOTIFY_UPDATES") {
                    console.log("Starting Spotify updates");
                    // first execute the function once
                    this.spotifyUpdates()
                        .then(() => {
                            // then set the interval
                            this.webSocket.spotifyUpdate = setInterval(() => {
                                this.spotifyUpdates();
                            }, 1000);
                        });
                }

                if (message === "STOP_SPOTIFY_UPDATES") {
                    if (this.webSocket.spotifyUpdate) {
                        clearInterval(this.webSocket.spotifyUpdate);
                        console.log("Spotify updates stopped");
                    }
                }
            }
        );
    }

    private async spotifyUpdates() {
        console.log("Checking Spotify")
        const user = this.webSocket.user;
        const spotifyConfig = user.spotifyConfig;
        if (Date.now() > spotifyConfig.expirationDate.getTime()) {
            console.log("Token expired");

            const token = await new SpotifyTokenService().refreshToken(spotifyConfig.refreshToken);
            user.spotifyConfig = {
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                expirationDate: new Date(Date.now() + token.expires_in * 1000),
                scope: token.scope,
            };
            const userService = await UserService.create();
            await userService.updateUser(user);
            console.log("Token refreshed and database updated");
        }
        const musicData = await getCurrentlyPlaying(user.spotifyConfig.accessToken);

        this.webSocket.send(JSON.stringify({
            type: "SPOTIFY_UPDATE",
            payload: musicData,
        }), {binary: false});
    }
}

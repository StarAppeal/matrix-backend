import {ExtendedWebSocket} from "../../interfaces/extendedWebsocket";
import {getCurrentlyPlaying} from "../../db/services/spotifyApiService";
import {SpotifyTokenService} from "../../db/services/spotifyTokenService";
import {UserService} from "../../db/services/db/UserService";
import {getCurrentWeather} from "../../db/services/owmApiService";

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
            if (this.webSocket.asyncUpdates) {
                clearInterval(this.webSocket.asyncUpdates);
                console.log("Async updates stopped");
            }
            callback();
        };
    }

    public enableMessageEvent() {
        this.webSocket.on("message", (data) => {
                const message = data.toString();
                const messageJson = JSON.parse(message);
                const {type} = messageJson;
                console.log("Received message:", message);

                if (type === "GET_SETTINGS") {
                    this.webSocket.send(JSON.stringify({
                        type: "SETTINGS",
                        payload: {
                            timezone: this.webSocket.user.timezone,
                        },
                    }), {binary: false});
                }

                if (type === "GET_STATE") {
                    const messageToSend = {
                        type: "STATE",
                        payload: this.webSocket.user.lastState,
                    };
                    this.webSocket.send(JSON.stringify(messageToSend), {binary: false});
                }

                if (type === "GET_SPOTIFY_UPDATES") {
                    console.log("Starting Spotify updates");
                    // first execute the function once
                    this.spotifyUpdates()
                        .then(() => {
                            // then set the interval
                            this.webSocket.asyncUpdates = setInterval(() => {
                                this.spotifyUpdates();
                            }, 1000);
                        });
                }
                if (type === "GET_WEATHER_UPDATES") {
                    console.log("Starting weather updates");
                    this.weatherUpdates().then(() => {
                            this.webSocket.asyncUpdates = setInterval(() => {
                                this.weatherUpdates();
                            }, 1000 * 60);
                        }
                    )
                }

                if (type === "STOP_SPOTIFY_UPDATES" || type === "STOP_WEATHER_UPDATES") {
                    if (this.webSocket.asyncUpdates) {
                        clearInterval(this.webSocket.asyncUpdates);
                        console.log("Async updates stopped");
                    }
                }

                if (type === "ERROR") {
                    const {message, traceback} = messageJson;
                    console.warn("Error message received", message);
                    console.warn("Traceback", traceback);
                }
            }
        );
    }

    private async spotifyUpdates() {
        console.log("Checking Spotify")
        const user = this.webSocket.user;
        const spotifyConfig = user.spotifyConfig;
        if (!spotifyConfig) {
            console.log("No Spotify config found");
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

        this.webSocket.send(JSON.stringify({
            type: "SPOTIFY_UPDATE",
            payload: musicData,
        }), {binary: false});
    }

    private async weatherUpdates() {
        console.log("Checking weather")
        const user = this.webSocket.user;
        const weather = await getCurrentWeather(user.location);
        console.log(weather);

        this.webSocket.send(JSON.stringify({
            type: "WEATHER_UPDATE",
            payload: weather,
        }), {binary: false});
    }
}

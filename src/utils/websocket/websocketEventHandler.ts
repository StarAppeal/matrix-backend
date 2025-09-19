import {ExtendedWebSocket} from "../../interfaces/extendedWebsocket";
import {CustomWebsocketEvent} from "./websocketCustomEvents/customWebsocketEvent";
import {UserService} from "../../db/services/db/UserService";
import {getEventListeners} from "./websocketCustomEvents/websocketEventUtils";
import {SpotifyTokenService} from "../../db/services/spotifyTokenService";

export class WebsocketEventHandler {
    constructor(private webSocket: ExtendedWebSocket, private userService: UserService, private spotifyTokenService: SpotifyTokenService) {
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
            console.log(`User: ${this.webSocket.payload.username} disconnected`);
            for (const [key, value] of this.webSocket.asyncUpdates) {
                console.log("Stopping Update:", key);
                clearInterval(value);
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

                // emit event to the custom event handler
                this.webSocket.emit(type, messageJson);
            }
        );
    }

    public registerCustomEvents() {
        const events = getEventListeners(this.webSocket, this.userService, this.spotifyTokenService);
        events.forEach(this.registerCustomEvent, this);
    }

    private registerCustomEvent(customWebsocketEvent: CustomWebsocketEvent) {
        this.webSocket.on(customWebsocketEvent.event, customWebsocketEvent.handler.bind(customWebsocketEvent));
    }

}

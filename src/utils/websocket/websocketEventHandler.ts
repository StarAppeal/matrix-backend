import { ExtendedWebSocket } from "../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./websocketCustomEvents/customWebsocketEvent";
import { getEventListeners } from "./websocketCustomEvents/websocketEventUtils";
import { SpotifyPollingService } from "../../services/spotifyPollingService";
import { WeatherPollingService } from "../../services/weatherPollingService";
import logger from "../../utils/logger";

export class WebsocketEventHandler {
    constructor(
        private webSocket: ExtendedWebSocket,
        private spotifyPollingService: SpotifyPollingService,
        private readonly weatherPollingService: WeatherPollingService
    ) {}

    public enableErrorEvent() {
        this.webSocket.on("error", (error) => {
            logger.error("WebSocket error:", error);
        });
    }

    //needed for the heartbeat mechanism
    public enablePongEvent() {
        this.webSocket.on("pong", () => {
            this.webSocket.isAlive = true;
            logger.debug("Pong received from client");
        });
    }

    public enableDisconnectEvent(callback: () => void) {
        this.webSocket.onclose = (event) => {
            logger.info(
                `WebSocket closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}, type=${event.type}`
            );
            logger.info(`User: ${this.webSocket.payload.username} disconnected`);

            callback();
        };
    }

    public enableMessageEvent() {
        this.webSocket.on("message", (data) => {
            const message = data.toString();
            const messageJson = JSON.parse(message);
            const { type } = messageJson;
            logger.debug(`Received WebSocket message of type "${type}"`, { messageData: messageJson });

            // emit event to the custom event handler
            this.webSocket.emit(type, messageJson);
        });
    }

    public registerCustomEvents() {
        const events = getEventListeners(this.webSocket, this.spotifyPollingService, this.weatherPollingService);
        events.forEach(this.registerCustomEvent, this);
    }

    private registerCustomEvent(customWebsocketEvent: CustomWebsocketEvent) {
        this.webSocket.on(customWebsocketEvent.event, customWebsocketEvent.handler.bind(customWebsocketEvent));
    }
}

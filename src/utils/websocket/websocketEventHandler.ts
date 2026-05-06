import { ExtendedWebSocket } from "../../interfaces/extendedWebsocket";
import { getEventListeners, WebsocketEvent } from "./websocketCustomEvents/websocketEventUtils";
import { MusicPollingService } from "../../services/musicPollingService";
import { WeatherPollingService } from "../../services/weatherPollingService";
import logger from "../../utils/logger";
import { TamagotchiPollingService } from "../../services/tamagotchiPollingService";

export class WebsocketEventHandler {
    constructor(
        private readonly webSocket: ExtendedWebSocket,
        private readonly musicPollingService: MusicPollingService,
        private readonly weatherPollingService: WeatherPollingService,
        private readonly tamagotchiPollingService: TamagotchiPollingService,
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
            const messageJson = this.validateMessage(message);
            if (!messageJson) {
                return;
            }
            const { type } = messageJson;
            logger.debug(`Received WebSocket message of type "${type}"`, { messageData: messageJson });

            // emit event to the custom event handler
            this.webSocket.emit(type, messageJson);
        });
    }

    public registerCustomEvents() {
        const events = getEventListeners(
            this.webSocket,
            this.musicPollingService,
            this.weatherPollingService,
            this.tamagotchiPollingService
        );
        events.forEach(this.registerCustomEvent, this);
    }

    private registerCustomEvent(customWebsocketEvent: WebsocketEvent) {
        this.webSocket.on(customWebsocketEvent.event, customWebsocketEvent.handler.bind(customWebsocketEvent));
    }

    private validateMessage(message: string) {
        let result = undefined;
        try {
            result = JSON.parse(message);
        } catch {
            logger.warn("Received invalid JSON from client");
            return;
        }
        if (!result || typeof result !== "object" || !("type" in result)) {
            logger.warn("Malformed WebSocket message structure");
            return;
        }
        return result;
    }
}

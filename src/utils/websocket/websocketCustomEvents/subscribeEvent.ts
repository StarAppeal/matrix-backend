import { WEATHER_TOPIC, WeatherPollingService } from "../../../services/weatherPollingService";
import { IUserPollingService } from "../../../services/IUserPollingService";
import { WebsocketEventType } from "./websocketEventType";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";

export class SubscribeEvent extends CustomWebsocketEvent<string> {
    event = WebsocketEventType.SUBSCRIBE;

    // Services that follow the simple per-user polling pattern.
    private readonly userPollingServices: Map<string, IUserPollingService>;

    constructor(
        ws: ExtendedWebSocket,
        private weatherPollingService: WeatherPollingService,
        userPollingServices: [topic: string, service: IUserPollingService][]
    ) {
        super(ws);
        this.userPollingServices = new Map(userPollingServices);
    }

    handler = async (topic: string) => {
        logger.info(`User ${this.ws.payload?.username} requested subscription to topic: ${topic}`);
        if (!this.ws.user) return;

        const uuid = this.ws.user.uuid;

        // Weather has a different subscription signature (location-based), handle separately.
        if (topic === WEATHER_TOPIC) {
            if (!this.ws.user.location?.lat || !this.ws.user.location?.lon) {
                logger.warn(`User ${uuid} has no location set`);
                return;
            }
            this.weatherPollingService.subscribeUser(
                uuid,
                this.ws.user.location.lat,
                this.ws.user.location.lon
            );
            return;
        }

        const service = this.userPollingServices.get(topic);
        if (service) {
            Promise.resolve(service.startPollingForUser(uuid)).catch((err) =>
                logger.error(`Failed to start polling for user ${uuid} on topic "${topic}":`, err)
            );
        } else {
            logger.debug(`Unknown subscription topic: ${topic}`);
        }
    };
}

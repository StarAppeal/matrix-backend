import { WEATHER_TOPIC, WeatherPollingService } from "../../../services/weatherPollingService";
import { IUserPollingService } from "../../../services/IUserPollingService";
import { WebsocketEventType } from "./websocketEventType";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";

export class UnsubscribeEvent extends CustomWebsocketEvent<string> {
    event = WebsocketEventType.UNSUBSCRIBE;

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
        logger.info(`User ${this.ws.payload?.username} requested unsubscription from topic: ${topic}`);
        if (!this.ws.user) return;

        const uuid = this.ws.user.uuid;

        // Weather has a different unsubscription signature (location-based), handle separately.
        if (topic === WEATHER_TOPIC) {
            if (!this.ws.user.location?.lat || !this.ws.user.location?.lon) {
                logger.warn(`User ${uuid} has no location set`);
                return;
            }
            this.weatherPollingService.unsubscribeUser(
                uuid,
                this.ws.user.location.lat,
                this.ws.user.location.lon
            );
            return;
        }

        const service = this.userPollingServices.get(topic);
        if (service) {
            service.stopPollingForUser(uuid);
        } else {
            logger.debug(`Unknown unsubscription topic: ${topic}`);
        }
    };
}

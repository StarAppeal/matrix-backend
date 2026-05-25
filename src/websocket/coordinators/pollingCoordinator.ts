import {
    appEventBus,
    WEBSOCKET_CLIENT_DISCONNECTED,
    WEBSOCKET_SUBSCRIBE_REQUEST,
    WEBSOCKET_UNSUBSCRIBE_REQUEST,
} from "../../utils/eventBus";
import { MusicPollingService } from "../../services/musicPollingService";
import { WeatherPollingService, WEATHER_TOPIC } from "../../services/weatherPollingService";
import { TamagotchiPollingService } from "../../services/tamagotchiPollingService";
import logger from "../../utils/logger";
import { IUser } from "../../db/models/user";

export class PollingCoordinator {
    constructor(
        private readonly musicPollingService: MusicPollingService,
        private readonly weatherPollingService: WeatherPollingService,
        private readonly tamagotchiPollingService: TamagotchiPollingService
    ) {
        this.setupListeners();
    }

    private setupListeners(): void {
        appEventBus.on(WEBSOCKET_CLIENT_DISCONNECTED, ({ uuid, user }: { uuid: string; user: IUser }) => {
            logger.info(`Cleaning up polling subscriptions for disconnected user ${uuid}`);
            if (user?.location?.lat && user?.location?.lon) {
                this.weatherPollingService.unsubscribeUser(uuid, user.location.lat, user.location.lon);
            }
            this.musicPollingService.stopPollingForUser(uuid);
            this.tamagotchiPollingService.stopPollingForUser(uuid);
        });

        appEventBus.on(WEBSOCKET_SUBSCRIBE_REQUEST, ({ uuid, topic, user }: { uuid: string; topic: string; user: IUser }) => {
            logger.debug(`Processing subscription request for user ${uuid} on topic ${topic}`);
            if (topic === WEATHER_TOPIC) {
                if (user?.location?.lat && user?.location?.lon) {
                    this.weatherPollingService.subscribeUser(uuid, user.location.lat, user.location.lon);
                } else {
                    logger.warn(`User ${uuid} has no location for weather subscription`);
                }
            } else if (topic === "music") {
                this.musicPollingService.startPollingForUser(uuid);
            } else if (topic === "tamagotchi") {
                this.tamagotchiPollingService.startPollingForUser(uuid);
            } else {
                logger.debug(`Unknown subscribe topic: ${topic}`);
            }
        });

        appEventBus.on(WEBSOCKET_UNSUBSCRIBE_REQUEST, ({ uuid, topic, user }: { uuid: string; topic: string; user: IUser }) => {
            logger.debug(`Processing unsubscription request for user ${uuid} from topic ${topic}`);
            if (topic === WEATHER_TOPIC) {
                if (user?.location?.lat && user?.location?.lon) {
                    this.weatherPollingService.unsubscribeUser(uuid, user.location.lat, user.location.lon);
                }
            } else if (topic === "music") {
                this.musicPollingService.stopPollingForUser(uuid);
            } else if (topic === "tamagotchi") {
                this.tamagotchiPollingService.stopPollingForUser(uuid);
            } else {
                logger.debug(`Unknown unsubscribe topic: ${topic}`);
            }
        });
    }
}

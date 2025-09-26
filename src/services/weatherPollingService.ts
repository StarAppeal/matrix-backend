import { appEventBus, USER_UPDATED_EVENT, WEATHER_STATE_UPDATED_EVENT } from "../utils/eventBus";
import { getCurrentWeather } from "./owmApiService";
import { IUser } from "../db/models/user";
import logger from "../utils/logger";

export class WeatherPollingService {
    private readonly activeLocationPolls: Map<string, NodeJS.Timeout>;
    private readonly locationSubscriptions: Map<string, Set<string>>;
    private readonly weatherCache: Map<string, any>;
    private readonly userLocationCache: Map<string, string>;

    constructor() {
        this.activeLocationPolls = new Map();
        this.locationSubscriptions = new Map();
        this.weatherCache = new Map();
        this.userLocationCache = new Map();

        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            this._handleUserUpdate(user);
        });
    }

    public subscribeUser(uuid: string, location: string): void {
        logger.info(`User ${uuid} subscribed to weather updates for location "${location}"`);

        if (!this.locationSubscriptions.has(location)) {
            this.locationSubscriptions.set(location, new Set());
        }
        this.locationSubscriptions.get(location)!.add(uuid);

        if (!this.activeLocationPolls.has(location)) {
            this._startPollingForLocation(location);
        } else {
            const cachedWeather = this.weatherCache.get(location);
            if (cachedWeather) {
                appEventBus.emit(WEATHER_STATE_UPDATED_EVENT, { weatherData: cachedWeather, subscribers: [uuid] });
            }
        }
        this.userLocationCache.set(uuid, location);
    }

    public unsubscribeUser(uuid: string, location: string): void {
        logger.info(`User ${uuid} unsubscribed from weather updates for location "${location}"`);

        const subscribers = this.locationSubscriptions.get(location);
        if (subscribers) {
            subscribers.delete(uuid);

            if (subscribers.size === 0) {
                this._stopPollingForLocation(location);
                this.locationSubscriptions.delete(location);
                this.weatherCache.delete(location);
            }
        }
        this.userLocationCache.delete(uuid);
    }

    private _startPollingForLocation(location: string): void {
        logger.info(`Starting new weather polling service for location: "${location}"`);
        const intervalId = setInterval(() => this._pollLocation(location), 1000 * 60 * 10);
        this.activeLocationPolls.set(location, intervalId);

        this._pollLocation(location);
    }

    private _stopPollingForLocation(location: string): void {
        if (this.activeLocationPolls.has(location)) {
            logger.info(`Stopping weather polling service for location: "${location}"`);
            clearInterval(this.activeLocationPolls.get(location)!);
            this.activeLocationPolls.delete(location);
        }
    }

    private async _pollLocation(location: string): Promise<void> {
        try {
            logger.debug(`Fetching weather data for location "${location}"`);
            const weatherData = await getCurrentWeather(location);
            if (!weatherData) return;

            this.weatherCache.set(location, weatherData);

            const subscribers = this.locationSubscriptions.get(location);
            if (subscribers && subscribers.size > 0) {
                appEventBus.emit(WEATHER_STATE_UPDATED_EVENT, { weatherData, subscribers: Array.from(subscribers) });
            }
        } catch (error) {
            logger.error(`Error polling weather data for location "${location}":`, error);
        }
    }

    private _handleUserUpdate(updatedUser: IUser): void {
        const uuid = updatedUser.uuid;
        const newLocation = updatedUser.location;
        const oldLocation = this.userLocationCache.get(uuid);

        if (oldLocation && newLocation && oldLocation !== newLocation) {
            logger.info(`Detected location change for user ${uuid} via User-Update.`);

            this.unsubscribeUser(uuid, oldLocation);
            this.subscribeUser(uuid, newLocation);
        }
    }
}

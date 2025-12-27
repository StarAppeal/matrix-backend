import { appEventBus, USER_UPDATED_EVENT, WEATHER_STATE_UPDATED_EVENT } from "../utils/eventBus";
import { getCurrentWeather } from "./owmApiService";
import { IUser } from "../db/models/user";
import logger from "../utils/logger";
import { CurrentWeather } from "openweather-api-node";

export class WeatherPollingService {
    private readonly activeLocationPolls: Map<string, NodeJS.Timeout>;
    private readonly locationSubscriptions: Map<string, Set<string>>;
    private readonly weatherCache: Map<string, CurrentWeather>;
    private readonly userLocationKeyCache: Map<string, string>;

    constructor() {
        this.activeLocationPolls = new Map();
        this.locationSubscriptions = new Map();
        this.weatherCache = new Map();
        this.userLocationKeyCache = new Map();

        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            this._handleUserUpdate(user);
        });
    }

    private _generateKey(lat: number, lon: number): string {
        return `${lat},${lon}`;
    }

    public subscribeUser(uuid: string, lat: number, lon: number): void {
        const locationKey = this._generateKey(lat, lon);
        logger.info(`User ${uuid} subscribed to weather updates for coords "${locationKey}"`);

        if (!this.locationSubscriptions.has(locationKey)) {
            this.locationSubscriptions.set(locationKey, new Set());
        }
        this.locationSubscriptions.get(locationKey)!.add(uuid);

        if (!this.activeLocationPolls.has(locationKey)) {
            this._startPollingForLocation(locationKey, lat, lon);
        } else {
            const cachedWeather = this.weatherCache.get(locationKey);
            if (cachedWeather) {
                appEventBus.emit(WEATHER_STATE_UPDATED_EVENT, { weatherData: cachedWeather, subscribers: [uuid] });
            }
        }

        this.userLocationKeyCache.set(uuid, locationKey);
    }

    public unsubscribeUser(uuid: string, lat: number, lon: number): void {
        const locationKey = this._generateKey(lat, lon);
        this._unsubscribeByKey(uuid, locationKey);
    }

    private _unsubscribeByKey(uuid: string, locationKey: string): void {
        logger.info(`User ${uuid} unsubscribed from weather updates for "${locationKey}"`);

        const subscribers = this.locationSubscriptions.get(locationKey);
        if (subscribers) {
            subscribers.delete(uuid);

            if (subscribers.size === 0) {
                this._stopPollingForLocation(locationKey);
                this.locationSubscriptions.delete(locationKey);
                this.weatherCache.delete(locationKey);
            }
        }
        this.userLocationKeyCache.delete(uuid);
    }

    private _startPollingForLocation(locationKey: string, lat: number, lon: number): void {
        logger.info(`Starting new weather polling service for: "${locationKey}"`);

        this._pollLocation(locationKey, lat, lon);

        const intervalId = setInterval(() => this._pollLocation(locationKey, lat, lon), 1000 * 60 * 10);
        this.activeLocationPolls.set(locationKey, intervalId);
    }

    private _stopPollingForLocation(locationKey: string): void {
        if (this.activeLocationPolls.has(locationKey)) {
            logger.info(`Stopping weather polling service for: "${locationKey}"`);
            clearInterval(this.activeLocationPolls.get(locationKey)!);
            this.activeLocationPolls.delete(locationKey);
        }
    }

    private async _pollLocation(locationKey: string, lat: number, lon: number): Promise<void> {
        try {
            logger.debug(`Fetching weather data for "${locationKey}"`);

            const weatherData = await getCurrentWeather(lat, lon);

            if (!weatherData) return;

            this.weatherCache.set(locationKey, weatherData);

            const subscribers = this.locationSubscriptions.get(locationKey);
            if (subscribers && subscribers.size > 0) {
                appEventBus.emit(WEATHER_STATE_UPDATED_EVENT, {
                    weatherData,
                    subscribers: Array.from(subscribers)
                });
            }
        } catch (error) {
            logger.error(`Error polling weather data for "${locationKey}":`, error);
        }
    }

    private _handleUserUpdate(updatedUser: IUser): void {
        const uuid = updatedUser.uuid;

        const newLat = updatedUser.location.lat;
        const newLon = updatedUser.location.lon;

        const oldKey = this.userLocationKeyCache.get(uuid);

        if (newLat === undefined || newLon === undefined) {
            if (oldKey) {
                this._unsubscribeByKey(uuid, oldKey);
            }
            return;
        }

        const newKey = this._generateKey(newLat, newLon);

        if (oldKey && oldKey !== newKey) {
            logger.info(`Detected location change for user ${uuid} via User-Update.`);
            this._unsubscribeByKey(uuid, oldKey);
            this.subscribeUser(uuid, newLat, newLon);
        } else if (!oldKey) {
            this.subscribeUser(uuid, newLat, newLon);
        }
    }
}
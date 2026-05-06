import OpenWeatherAPI from "openweather-api-node";
import { find } from "geo-tz";
import logger from "../utils/logger";

export class OwmApiService {
    constructor(private readonly apiKey: string) { }

    public async getCurrentWeather(lat: number, lon: number) {
        const api = new OpenWeatherAPI({ key: this.apiKey, units: "metric" });
        api.setLocationByCoordinates(lat, lon);
        return await api.getCurrent();
    }

    public async validateLocation(query: string) {
        const api = new OpenWeatherAPI({ key: this.apiKey, units: "metric" });
        try {
            return await api.getAllLocations(query);
        } catch (error) {
            logger.error("Geocoding Error", error);
            return [];
        }
    }

    public getTimezoneName(lat: number, lon: number): string {
        const tz = find(lat, lon);
        return tz[0] || "Etc/UTC";
    }
}

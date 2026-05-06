import OpenWeatherAPI from "openweather-api-node";
import { find } from "geo-tz";
import logger from "../utils/logger";

function getWeatherInstance(): OpenWeatherAPI {
    return new OpenWeatherAPI({
        key: process.env.OWM_API_KEY,
        units: "metric"
    });
}

export async function getCurrentWeather(lat: number, lon: number) {
    const weather = getWeatherInstance();

    weather.setLocationByCoordinates(lat, lon);

    return await weather.getCurrent();
}

export async function validateLocation(query: string) {
    const weather = getWeatherInstance();

    try {
        return await weather.getAllLocations(query);
    } catch (error) {
        logger.error("Geocoding Error", error);
        return [];
    }
}

export function getTimezoneName(lat: number, lon: number): string {
    const tz = find(lat, lon);
    return tz[0] || "Etc/UTC";
}

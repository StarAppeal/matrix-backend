import OpenWeatherAPI from "openweather-api-node";
import { find } from "geo-tz";

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
        console.log(query);
        return await weather.getAllLocations(query);
    } catch (error) {
        console.error("Geocoding Error", error);
        return [];
    }
}

export function getTimezoneName(lat: number, lon: number): string {
    const tz = find(lat, lon);
    return tz[0] || "Etc/UTC";
}

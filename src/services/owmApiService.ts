import OpenWeatherAPI from "openweather-api-node";

function getWeatherInstance(): OpenWeatherAPI {
    return new OpenWeatherAPI({
        key: process.env.OWM_API_KEY,
    });
}

export async function getCurrentWeather(location: string) {
    return getWeatherInstance().getCurrent({
        locationName: location,
        units: "metric",
    });
}

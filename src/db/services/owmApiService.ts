import OpenWeatherAPI from "openweather-api-node"

const weather = new OpenWeatherAPI({
    key: process.env.OWM_API_KEY,
});

export async function getCurrentWeather(location: string) {
    return weather.getCurrent({
        locationName: location,
        units: "metric"
    });
}

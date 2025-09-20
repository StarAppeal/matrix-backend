import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {NoData} from "./NoData";
import {getCurrentWeather} from "../../../services/owmApiService";

export const WeatherAsyncUpdateEvent = "WEATHER_UPDATE";

export class GetWeatherUpdatesEvent extends CustomWebsocketEvent<NoData> {

    event = WebsocketEventType.GET_WEATHER_UPDATES;

    handler = async () => {
        console.log("Starting weather updates");
        this.ws.emit(WebsocketEventType.GET_SINGLE_WEATHER_UPDATE);

        if (this.ws.asyncUpdates.has(WeatherAsyncUpdateEvent)) {
            console.log("Weather updates already running");
            return;
        }

        this.ws.asyncUpdates.set(WeatherAsyncUpdateEvent, setInterval(() => {
            this.ws.emit(WebsocketEventType.GET_SINGLE_WEATHER_UPDATE);
        }, 1000 * 60));

    }
}

export class GetSingleWeatherUpdateEvent extends CustomWebsocketEvent<NoData> {

    event = WebsocketEventType.GET_SINGLE_WEATHER_UPDATE;

    handler = async () => {
        console.log("Getting single weather update event");
        await this.weatherUpdates();
    }

    private async weatherUpdates() {
        console.log("Checking weather")
        const user = this.ws.user;
        const weather = await getCurrentWeather(user.location);
        console.log(weather);

        this.ws.send(JSON.stringify({
            type: "WEATHER_UPDATE",
            payload: weather,
        }), {binary: false});
    }

}

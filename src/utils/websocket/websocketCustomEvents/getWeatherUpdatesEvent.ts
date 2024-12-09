import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {getCurrentWeather} from "../../../db/services/owmApiService";

export class GetWeatherUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.GET_WEATHER_UPDATES;

    handler = async () => {
        console.log("Starting weather updates");
        this.ws.emit(WebsocketEventType.GET_SINGLE_WEATHER_UPDATE);

        this.ws.asyncUpdates = setInterval(() => {
            this.ws.emit(WebsocketEventType.GET_SINGLE_WEATHER_UPDATE);
        }, 1000 * 60);
    }
}

export class GetSingleWeatherUpdateEvent extends CustomWebsocketEvent {

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

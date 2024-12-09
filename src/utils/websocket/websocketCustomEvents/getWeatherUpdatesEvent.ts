import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {getCurrentWeather} from "../../../db/services/owmApiService";

export class GetWeatherUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.GET_WEATHER_UPDATES;

    handler = async () => {
        console.log("Starting weather updates");
        this.weatherUpdates().then(() => {
                this.ws.asyncUpdates = setInterval(() => {
                    this.weatherUpdates();
                }, 1000 * 60);
            }
        );
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

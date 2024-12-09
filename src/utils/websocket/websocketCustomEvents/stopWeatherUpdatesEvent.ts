import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {WeatherAsyncUpdateEvent} from "./getWeatherUpdatesEvent";

export class StopWeatherUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.STOP_WEATHER_UPDATES;

    handler = async () => {
        if (this.ws.asyncUpdates.has(WeatherAsyncUpdateEvent)) {
            clearInterval(this.ws.asyncUpdates.get(WeatherAsyncUpdateEvent));
            this.ws.asyncUpdates.delete(WeatherAsyncUpdateEvent);
            console.log("Weather updates stopped");
        }
    }

}

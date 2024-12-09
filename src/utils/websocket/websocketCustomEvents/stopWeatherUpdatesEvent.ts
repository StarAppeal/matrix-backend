import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";

export class StopWeatherUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.STOP_WEATHER_UPDATES;

    handler = async () => {
        if (this.ws.asyncUpdates) {
            clearInterval(this.ws.asyncUpdates);
            console.log("Weather updates stopped");
        }
    }


}

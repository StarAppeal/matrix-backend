import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";
import { CurrentWeather } from "openweather-api-node";

export class SingleWeatherUpdateEvent extends CustomWebsocketEvent<CurrentWeather> {
    event = WebsocketEventType.SINGLE_WEATHER_UPDATE;

    handler = async (weatherData: CurrentWeather) => {
        logger.debug(`Sending weather update to user ${this.ws.payload?.username}`);

        this.ws.send(
            JSON.stringify({
                type: "WEATHER_UPDATE",
                payload: weatherData,
            }),
            { binary: false }
        );
    };
}

import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { WeatherPollingService } from "../../../services/weatherPollingService";

export class StopWeatherUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.STOP_WEATHER_UPDATES;
    private readonly weatherPollingService: WeatherPollingService;

    constructor(ws: ExtendedWebSocket, weatherPollingService: WeatherPollingService) {
        super(ws);
        this.weatherPollingService = weatherPollingService;
    }

    handler = async () => {
        console.log(`User ${this.ws.user.uuid} requested stop weather updates`);
        const user = this.ws.user;
        if (user?.location && user.uuid) {
            this.weatherPollingService.unsubscribeUser(user.uuid, user.location);
        }
    };
}

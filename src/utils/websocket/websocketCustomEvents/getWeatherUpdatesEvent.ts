import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { WeatherPollingService } from "../../../services/weatherPollingService";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";

export class GetWeatherUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.GET_WEATHER_UPDATES;
    private readonly weatherPollingService: WeatherPollingService;

    constructor(ws: ExtendedWebSocket, weatherPollingService: WeatherPollingService) {
        super(ws);
        this.weatherPollingService = weatherPollingService;
    }

    handler = async () => {
        const user = this.ws.user;
        console.log(`User ${user?.uuid} requested to get weather updates`);
        if (user?.location && user.uuid) {
            this.weatherPollingService.subscribeUser(user.uuid, user.location.lat, user.location.lon);
        }
    };
}

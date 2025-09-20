import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {GetSettingsEvent} from "./getSettingsEvent";
import {ErrorEvent} from "./errorEvent";
import {GetSpotifyUpdatesEvent} from "./getSpotifyUpdatesEvent";
import {GetStateEvent} from "./getStateEvent";
import {GetWeatherUpdatesEvent} from "./getWeatherUpdatesEvent";
import {StopSpotifyUpdatesEvent} from "./stopSpotifyUpdatesEvent";
import {StopWeatherUpdatesEvent} from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent} from "./updateUserEvent";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {SpotifyPollingService} from "../../../services/spotifyPollingService";
import {WeatherPollingService} from "../../../services/weatherPollingService";

export function getEventListeners(ws: ExtendedWebSocket, spotifyPollingService: SpotifyPollingService, weatherPollingService:WeatherPollingService): CustomWebsocketEvent[] {
    return [
        new GetStateEvent(ws),
        new GetSettingsEvent(ws),
        new GetSpotifyUpdatesEvent(ws, spotifyPollingService),
        new StopSpotifyUpdatesEvent(ws, spotifyPollingService),
        new GetWeatherUpdatesEvent(ws, weatherPollingService),
        new StopWeatherUpdatesEvent(ws, weatherPollingService),
        new UpdateUserSingleEvent(ws),
        new ErrorEvent(ws)
    ];
}

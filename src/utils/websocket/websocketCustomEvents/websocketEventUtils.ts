import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {GetSettingsEvent} from "./getSettingsEvent";
import {ErrorEvent} from "./errorEvent";
import {GetSpotifyUpdatesEvent} from "./getSpotifyUpdatesEvent";
import {GetStateEvent} from "./getStateEvent";
import {GetSingleWeatherUpdateEvent, GetWeatherUpdatesEvent} from "./getWeatherUpdatesEvent";
import {StopSpotifyUpdatesEvent} from "./stopSpotifyUpdatesEvent";
import {StopWeatherUpdatesEvent} from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent} from "./updateUserEvent";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {SpotifyPollingService} from "../../../services/spotifyPollingService";

export function getEventListeners(ws: ExtendedWebSocket, spotifyPollingService: SpotifyPollingService): CustomWebsocketEvent[] {
    return [
        new GetStateEvent(ws),
        new GetSettingsEvent(ws),
        new GetSpotifyUpdatesEvent(ws, spotifyPollingService),
        new StopSpotifyUpdatesEvent(ws, spotifyPollingService),
        new GetSingleWeatherUpdateEvent(ws),
        new GetWeatherUpdatesEvent(ws),
        new StopWeatherUpdatesEvent(ws),
        new UpdateUserSingleEvent(ws),
        new ErrorEvent(ws)
    ];
}

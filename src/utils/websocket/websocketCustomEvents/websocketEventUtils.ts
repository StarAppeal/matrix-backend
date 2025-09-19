import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {GetSettingsEvent} from "./getSettingsEvent";
import {ErrorEvent} from "./errorEvent";
import {GetSingleSpotifyUpdateEvent, GetSpotifyUpdatesEvent} from "./getSpotifyUpdatesEvent";
import {GetStateEvent} from "./getStateEvent";
import {GetSingleWeatherUpdateEvent, GetWeatherUpdatesEvent} from "./getWeatherUpdatesEvent";
import {StopSpotifyUpdatesEvent} from "./stopSpotifyUpdatesEvent";
import {StopWeatherUpdatesEvent} from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent} from "./updateUserEvent";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {UserService} from "../../../db/services/db/UserService";
import {SpotifyTokenService} from "../../../db/services/spotifyTokenService";

export function getEventListeners(ws: ExtendedWebSocket, userService: UserService, spotifyTokenService: SpotifyTokenService): CustomWebsocketEvent[] {
    return [
        new GetStateEvent(ws),
        new GetSettingsEvent(ws),
        new GetSingleSpotifyUpdateEvent(ws, userService, spotifyTokenService),
        new GetSpotifyUpdatesEvent(ws),
        new StopSpotifyUpdatesEvent(ws),
        new GetSingleWeatherUpdateEvent(ws),
        new GetWeatherUpdatesEvent(ws),
        new StopWeatherUpdatesEvent(ws),
        new UpdateUserSingleEvent(ws),
        new ErrorEvent(ws)
    ];
}

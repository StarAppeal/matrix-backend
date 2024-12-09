import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {GetSettingsEvent} from "./getSettingsEvent";
import {ErrorEvent} from "./errorEvent";
import {GetSingleSpotifyUpdateEvent, GetSpotifyUpdatesEvent} from "./getSpotifyUpdatesEvent";
import {GetStateEvent} from "./getStateEvent";
import {GetSingleWeatherUpdateEvent, GetWeatherUpdatesEvent} from "./getWeatherUpdatesEvent";
import {StopSpotifyUpdatesEvent} from "./stopSpotifyUpdatesEvent";
import {StopWeatherUpdatesEvent} from "./stopWeatherUpdatesEvent";
import {UpdateUserEvent, UpdateUserSingleEvent} from "./updateUserEvent";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {StopUpdateUserEvent} from "./stopUpdateUserEvent";

export function getEventListeners(ws: ExtendedWebSocket): CustomWebsocketEvent[] {
    return [
        new GetStateEvent(ws),
        new GetSettingsEvent(ws),
        new GetSingleSpotifyUpdateEvent(ws),
        new GetSpotifyUpdatesEvent(ws),
        new StopSpotifyUpdatesEvent(ws),
        new GetSingleWeatherUpdateEvent(ws),
        new GetWeatherUpdatesEvent(ws),
        new StopWeatherUpdatesEvent(ws),
        new UpdateUserEvent(ws),
        new UpdateUserSingleEvent(ws),
        new StopUpdateUserEvent(ws),
        new ErrorEvent(ws)
    ];
}

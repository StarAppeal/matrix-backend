import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {GetSettingsEvent} from "./getSettingsEvent";
import {ErrorEvent} from "./errorEvent";
import {GetSpotifyUpdatesEvent} from "./getSpotifyUpdatesEvent";
import {GetStateEvent} from "./getStateEvent";
import {GetWeatherUpdatesEvent} from "./getWeatherUpdatesEvent";
import {StopSpotifyUpdatesEvent} from "./stopSpotifyUpdatesEvent";
import {StopWeatherUpdatesEvent} from "./stopWeatherUpdatesEvent";
import {UpdateUserEvent} from "./updateUserEvent";
import {CustomWebsocketEvent} from "./customWebsocketEvent";

export function getEventListeners(ws: ExtendedWebSocket): CustomWebsocketEvent[] {
    return [
        new GetSettingsEvent(ws),
        new ErrorEvent(ws),
        new GetSpotifyUpdatesEvent(ws),
        new GetStateEvent(ws),
        new GetWeatherUpdatesEvent(ws),
        new StopSpotifyUpdatesEvent(ws),
        new StopWeatherUpdatesEvent(ws),
        new UpdateUserEvent(ws)
    ];
}

import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { GetSettingsEvent } from "./getSettingsEvent";
import { ErrorEvent } from "./errorEvent";
import { GetSpotifyUpdatesEvent } from "./getSpotifyUpdatesEvent";
import { GetStateEvent } from "./getStateEvent";
import { GetWeatherUpdatesEvent } from "./getWeatherUpdatesEvent";
import { StopSpotifyUpdatesEvent } from "./stopSpotifyUpdatesEvent";
import { StopWeatherUpdatesEvent } from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent } from "./updateUserEvent";
import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";
import { SingleSpotifyUpdateEvent } from "./singleSpotifyUpdateEvent";
import { SingleWeatherUpdateEvent } from "./singleWeatherUpdateEvent";

export type WebsocketEvent =
    | GetStateEvent
    | GetSettingsEvent
    | GetSpotifyUpdatesEvent
    | StopSpotifyUpdatesEvent
    | GetWeatherUpdatesEvent
    | StopWeatherUpdatesEvent
    | UpdateUserSingleEvent
    | SingleSpotifyUpdateEvent
    | SingleWeatherUpdateEvent
    | ErrorEvent;

export function getEventListeners(
    ws: ExtendedWebSocket,
    spotifyPollingService: SpotifyPollingService,
    weatherPollingService: WeatherPollingService
): WebsocketEvent[] {
    return [
        new GetStateEvent(ws),
        new GetSettingsEvent(ws),
        new GetSpotifyUpdatesEvent(ws, spotifyPollingService),
        new StopSpotifyUpdatesEvent(ws, spotifyPollingService),
        new GetWeatherUpdatesEvent(ws, weatherPollingService),
        new StopWeatherUpdatesEvent(ws, weatherPollingService),
        new UpdateUserSingleEvent(ws),
        new SingleSpotifyUpdateEvent(ws),
        new SingleWeatherUpdateEvent(ws),
        new ErrorEvent(ws),
    ];
}

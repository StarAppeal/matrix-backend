import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";

import { GetSettingsEvent } from "./getSettingsEvent";
import { GetSpotifyUpdatesEvent } from "./getSpotifyUpdatesEvent";
import { GetStateEvent } from "./getStateEvent";
import { StopSpotifyUpdatesEvent } from "./stopSpotifyUpdatesEvent";
import { GetWeatherUpdatesEvent } from "./getWeatherUpdatesEvent";
import { StopWeatherUpdatesEvent } from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent } from "./updateUserEvent";
import { SingleSpotifyUpdateEvent } from "./singleSpotifyUpdateEvent";
import { SingleWeatherUpdateEvent } from "./singleWeatherUpdateEvent";
import { ErrorEvent } from "./errorEvent";

interface ServiceDependencies {
    spotifyPollingService: SpotifyPollingService;
    weatherPollingService: WeatherPollingService;
}

export const eventRegistry = [
    {
        Klass: GetStateEvent,
        factory: (ws: ExtendedWebSocket) => new GetStateEvent(ws),
    },
    {
        Klass: GetSettingsEvent,
        factory: (ws: ExtendedWebSocket) => new GetSettingsEvent(ws),
    },
    {
        Klass: GetSpotifyUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { spotifyPollingService }: ServiceDependencies) =>
            new GetSpotifyUpdatesEvent(ws, spotifyPollingService),
    },
    {
        Klass: StopSpotifyUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { spotifyPollingService }: ServiceDependencies) =>
            new StopSpotifyUpdatesEvent(ws, spotifyPollingService),
    },
    {
        Klass: GetWeatherUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { weatherPollingService }: ServiceDependencies) =>
            new GetWeatherUpdatesEvent(ws, weatherPollingService),
    },
    {
        Klass: StopWeatherUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { weatherPollingService }: ServiceDependencies) =>
            new StopWeatherUpdatesEvent(ws, weatherPollingService),
    },
    {
        Klass: UpdateUserSingleEvent,
        factory: (ws: ExtendedWebSocket) => new UpdateUserSingleEvent(ws),
    },
    {
        Klass: SingleSpotifyUpdateEvent,
        factory: (ws: ExtendedWebSocket) => new SingleSpotifyUpdateEvent(ws),
    },
    {
        Klass: SingleWeatherUpdateEvent,
        factory: (ws: ExtendedWebSocket) => new SingleWeatherUpdateEvent(ws),
    },
    {
        Klass: ErrorEvent,
        factory: (ws: ExtendedWebSocket) => new ErrorEvent(ws),
    },
];

export type WebsocketEvent = ReturnType<typeof eventRegistry[number]["factory"]>;
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { MusicPollingService } from "../../../services/musicPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";

import { GetSettingsEvent } from "./getSettingsEvent";
import { GetMusicUpdatesEvent } from "./getMusicUpdatesEvent";
import { GetStateEvent } from "./getStateEvent";
import { StopMusicUpdatesEvent } from "./stopMusicUpdatesEvent";
import { GetWeatherUpdatesEvent } from "./getWeatherUpdatesEvent";
import { StopWeatherUpdatesEvent } from "./stopWeatherUpdatesEvent";
import { UpdateUserSingleEvent } from "./updateUserEvent";
import { SingleMusicUpdateEvent } from "./singleMusicUpdateEvent";
import { SingleWeatherUpdateEvent } from "./singleWeatherUpdateEvent";
import { ErrorEvent } from "./errorEvent";

interface ServiceDependencies {
    musicPollingService: MusicPollingService;
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
        Klass: GetMusicUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { musicPollingService }: ServiceDependencies) =>
            new GetMusicUpdatesEvent(ws, musicPollingService),
    },
    {
        Klass: StopMusicUpdatesEvent,
        factory: (ws: ExtendedWebSocket, { musicPollingService }: ServiceDependencies) =>
            new StopMusicUpdatesEvent(ws, musicPollingService),
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
        Klass: SingleMusicUpdateEvent,
        factory: (ws: ExtendedWebSocket) => new SingleMusicUpdateEvent(ws),
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

export type WebsocketEvent = ReturnType<(typeof eventRegistry)[number]["factory"]>;

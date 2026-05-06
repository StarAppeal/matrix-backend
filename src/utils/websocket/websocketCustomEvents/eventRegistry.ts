import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { MusicPollingService } from "../../../services/musicPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";
import { TamagotchiPollingService } from "../../../services/tamagotchiPollingService";

import { GetSettingsEvent } from "./getSettingsEvent";
import { GetStateEvent } from "./getStateEvent";
import { UpdateUserSingleEvent } from "./updateUserEvent";
import { SingleMusicUpdateEvent } from "./singleMusicUpdateEvent";
import { SingleWeatherUpdateEvent } from "./singleWeatherUpdateEvent";
import { ErrorEvent } from "./errorEvent";
import { SingleTamagotchiUpdate } from "./singleTamagotchiUpdate";
import { SubscribeEvent } from "./subscribeEvent";
import { UnsubscribeEvent } from "./unsubscribeEvent";

interface ServiceDependencies {
    musicPollingService: MusicPollingService;
    weatherPollingService: WeatherPollingService;
    tamagotchiPollingService: TamagotchiPollingService;
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
        Klass: SubscribeEvent,
        factory: (ws: ExtendedWebSocket, { musicPollingService, weatherPollingService, tamagotchiPollingService }: ServiceDependencies) =>
            new SubscribeEvent(ws, weatherPollingService, [
                ["music", musicPollingService],
                ["tamagotchi", tamagotchiPollingService],
            ]),
    },
    {
        Klass: UnsubscribeEvent,
        factory: (ws: ExtendedWebSocket, { musicPollingService, weatherPollingService, tamagotchiPollingService }: ServiceDependencies) =>
            new UnsubscribeEvent(ws, weatherPollingService, [
                ["music", musicPollingService],
                ["tamagotchi", tamagotchiPollingService],
            ]),
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
        Klass: SingleTamagotchiUpdate,
        factory: (ws: ExtendedWebSocket) => new SingleTamagotchiUpdate(ws),
    },
    {
        Klass: ErrorEvent,
        factory: (ws: ExtendedWebSocket) => new ErrorEvent(ws),
    },
];

export type WebsocketEvent = ReturnType<(typeof eventRegistry)[number]["factory"]>;

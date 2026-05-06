import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { MusicPollingService } from "../../../services/musicPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";

import { eventRegistry, WebsocketEvent } from "./eventRegistry";
import { TamagotchiPollingService } from "../../../services/tamagotchiPollingService";

export function getEventListeners(
    ws: ExtendedWebSocket,
    musicPollingService: MusicPollingService,
    weatherPollingService: WeatherPollingService,
    tamagotchiPollingService: TamagotchiPollingService
): WebsocketEvent[] {
    const services = {
        musicPollingService,
        weatherPollingService,
        tamagotchiPollingService,
    };

    return eventRegistry.map((descriptor) => descriptor.factory(ws, services));
}

export type { WebsocketEvent };

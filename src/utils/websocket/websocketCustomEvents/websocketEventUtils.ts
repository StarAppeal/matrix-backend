import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { MusicPollingService } from "../../../services/musicPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";

import { eventRegistry, WebsocketEvent } from "./eventRegistry";

export function getEventListeners(
    ws: ExtendedWebSocket,
    musicPollingService: MusicPollingService,
    weatherPollingService: WeatherPollingService
): WebsocketEvent[] {
    const services = {
        musicPollingService,
        weatherPollingService,
    };

    return eventRegistry.map((descriptor) => descriptor.factory(ws, services));
}

export type { WebsocketEvent };

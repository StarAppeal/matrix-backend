import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { WeatherPollingService } from "../../../services/weatherPollingService";

import { eventRegistry, WebsocketEvent } from "./eventRegistry";

export function getEventListeners(
    ws: ExtendedWebSocket,
    spotifyPollingService: SpotifyPollingService,
    weatherPollingService: WeatherPollingService
): WebsocketEvent[] {
    const services = {
        spotifyPollingService,
        weatherPollingService,
    };

    return eventRegistry.map((descriptor) => descriptor.factory(ws, services));
}

export type { WebsocketEvent };

import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { eventRegistry, WebsocketEvent } from "./eventRegistry";

export function getEventListeners(ws: ExtendedWebSocket): WebsocketEvent[] {
    return eventRegistry.map((descriptor) => descriptor.factory(ws));
}

export type { WebsocketEvent };

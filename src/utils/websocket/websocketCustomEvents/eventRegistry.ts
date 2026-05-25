import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";

import { GetSettingsEvent } from "./getSettingsEvent";
import { GetStateEvent } from "./getStateEvent";
import { ErrorEvent } from "./errorEvent";
import { SubscribeEvent } from "./subscribeEvent";
import { UnsubscribeEvent } from "./unsubscribeEvent";

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
        factory: (ws: ExtendedWebSocket) => new SubscribeEvent(ws),
    },
    {
        Klass: UnsubscribeEvent,
        factory: (ws: ExtendedWebSocket) => new UnsubscribeEvent(ws),
    },
    {
        Klass: ErrorEvent,
        factory: (ws: ExtendedWebSocket) => new ErrorEvent(ws),
    },
];

export type WebsocketEvent = ReturnType<(typeof eventRegistry)[number]["factory"]>;

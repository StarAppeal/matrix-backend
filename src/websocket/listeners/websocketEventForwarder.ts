import {
    appEventBus,
    USER_UPDATED_EVENT,
    COMMAND_SEND_SETTINGS,
    WEATHER_STATE_UPDATED_EVENT,
    TAMAGOTCHI_STATE_UPDATED_EVENT,
} from "../../utils/eventBus";
import { ExtendedWebSocketServer } from "../../websocket";
import { WebsocketOutboundType } from "../../utils/websocket/websocketCustomEvents/websocketOutboundType";
import { IUser } from "../../db/models/user";
import logger from "../../utils/logger";

export class WebsocketEventForwarder {
    constructor(private readonly wss: ExtendedWebSocketServer) {
        this.setupListeners();
    }

    private setupListeners(): void {
        appEventBus.on(USER_UPDATED_EVENT, (user: IUser) => {
            logger.debug(`Received user update for user ${user.uuid} - updating websocket client cache`);
            this.wss.updateUserInMap(user);
        });

        appEventBus.on(COMMAND_SEND_SETTINGS, ({ uuid }: { uuid: string }) => {
            logger.debug(`Received settings request for user ${uuid}`);
            const user = this.wss.getUser(uuid);
            if (user) {
                this.wss.sendPayload(uuid, WebsocketOutboundType.SETTINGS, { timezone: user.timezone });
            } else {
                logger.warn(`Could not find client/user ${uuid} to send settings`);
            }
        });

        appEventBus.on(WEATHER_STATE_UPDATED_EVENT, ({ weatherData, subscribers }: { weatherData: unknown; subscribers: string[] }) => {
            for (const uuid of subscribers) {
                logger.debug(`Received weather update for user ${uuid}`);
                this.wss.sendPayload(uuid, WebsocketOutboundType.WEATHER_UPDATE, weatherData);
            }
        });

        appEventBus.on(TAMAGOTCHI_STATE_UPDATED_EVENT, ({ uuid, payload }: { uuid: string; payload: unknown }) => {
            logger.debug(`Received tamagotchi update for user ${uuid}`);
            this.wss.sendPayload(uuid, WebsocketOutboundType.TAMAGOTCHI_UPDATE, payload);
        });
    }
}

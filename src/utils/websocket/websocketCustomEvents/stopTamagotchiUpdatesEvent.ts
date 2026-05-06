import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";
import { TamagotchiPollingService } from "../../../services/tamagotchiPollingService";

export class StopTamagotchiUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.STOP_TAMAGOTCHI_UPDATES;

    constructor(
        ws: ExtendedWebSocket,
        private tamagotchiPollingService: TamagotchiPollingService
    ) {
        super(ws);
    }

    handler = async () => {
        logger.info(`User ${this.ws.payload?.username} requested to stop tamagotchi updates`);
        if (this.ws.user) {
            try {
                this.tamagotchiPollingService.stopPollingForUser(this.ws.user.uuid);
            } catch (error) {
                logger.error(`Failed to stop tamagotchi polling for ${this.ws.user.uuid}`, error);
            }
        }
    };
}

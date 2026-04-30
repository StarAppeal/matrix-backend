import { MusicPollingService } from "../../../services/musicPollingService";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import logger from "../../../utils/logger";

export class GetMusicUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.GET_MUSIC_UPDATES;

    constructor(
        ws: ExtendedWebSocket,
        private musicPollingService: MusicPollingService
    ) {
        super(ws);
    }

    handler = async () => {
        logger.info(`User ${this.ws.payload?.username} requested music updates - starting polling service`);
        if (this.ws.user) {
            this.musicPollingService.startPollingForUser(this.ws.user);
        }
    };
}

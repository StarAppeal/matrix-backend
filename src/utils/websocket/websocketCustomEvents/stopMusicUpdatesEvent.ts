import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import logger from "../../../utils/logger";
import { MusicPollingService } from "../../../services/musicPollingService";

export class StopMusicUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.STOP_MUSIC_UPDATES;

    private readonly musicPollingService: MusicPollingService;

    constructor(ws: ExtendedWebSocket, musicPollingService: MusicPollingService) {
        super(ws);
        this.musicPollingService = musicPollingService;
    }

    handler = async () => {
        logger.info(`User ${this.ws.payload?.username} requested to stop music updates`);

        const uuid = this.ws.payload?.uuid;

        if (uuid) {
            this.musicPollingService.stopPollingForUser(uuid);
        } else {
            logger.warn("Could not stop music polling: No UUID found on WebSocket payload.");
        }
    };
}

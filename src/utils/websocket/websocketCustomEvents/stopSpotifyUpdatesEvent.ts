import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import logger from "../../../utils/logger";

export class StopSpotifyUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.STOP_SPOTIFY_UPDATES;

    private readonly spotifyPollingService: SpotifyPollingService;

    constructor(ws: ExtendedWebSocket, spotifyPollingService: SpotifyPollingService) {
        super(ws);
        this.spotifyPollingService = spotifyPollingService;
    }

    handler = async () => {
        logger.info(`User ${this.ws.payload?.username} requested to stop Spotify updates`);

        const uuid = this.ws.payload?.uuid;

        if (uuid) {
            this.spotifyPollingService.stopPollingForUser(uuid);
        } else {
            logger.warn("Could not stop Spotify polling: No UUID found on WebSocket payload.");
        }
    };
}

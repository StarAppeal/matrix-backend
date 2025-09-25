import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";

export class StopSpotifyUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.STOP_SPOTIFY_UPDATES;

    private readonly spotifyPollingService: SpotifyPollingService;

    constructor(ws: ExtendedWebSocket, spotifyPollingService: SpotifyPollingService) {
        super(ws);
        this.spotifyPollingService = spotifyPollingService;
    }

    handler = async () => {
        console.log("Client requests to stop Spotify updates. Stopping polling.");

        const uuid = this.ws.payload?.uuid;

        if (uuid) {
            this.spotifyPollingService.stopPollingForUser(uuid);
        } else {
            console.warn("Could not stop Spotify polling: No UUID found on WebSocket payload.");
        }
    };
}

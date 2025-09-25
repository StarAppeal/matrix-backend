import { SpotifyPollingService } from "../../../services/spotifyPollingService";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";
import { ExtendedWebSocket } from "../../../interfaces/extendedWebsocket";
import { CustomWebsocketEvent } from "./customWebsocketEvent";

export class GetSpotifyUpdatesEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.GET_SPOTIFY_UPDATE;

    constructor(
        ws: ExtendedWebSocket,
        private spotifyPollingService: SpotifyPollingService
    ) {
        super(ws);
    }

    handler = async () => {
        console.log("Client requests Spotify updates. Starting polling.");
        if (this.ws.user) {
            this.spotifyPollingService.startPollingForUser(this.ws.user);
        }
    };
}

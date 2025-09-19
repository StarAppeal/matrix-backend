import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";
import {SpotifyAsyncUpdateEvent} from "./getSpotifyUpdatesEvent";
import {NoData} from "./NoData";

export class StopSpotifyUpdatesEvent extends CustomWebsocketEvent<NoData> {

    event = WebsocketEventType.STOP_SPOTIFY_UPDATES;

    handler = async () => {
        if (this.ws.asyncUpdates.has(SpotifyAsyncUpdateEvent)) {
            clearInterval(this.ws.asyncUpdates.get(SpotifyAsyncUpdateEvent));
            this.ws.asyncUpdates.delete(SpotifyAsyncUpdateEvent);
            console.log("Spotify updates stopped");
        }
    }


}

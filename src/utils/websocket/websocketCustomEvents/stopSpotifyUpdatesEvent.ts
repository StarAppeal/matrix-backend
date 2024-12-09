import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";

export class StopSpotifyUpdatesEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.STOP_SPOTIFY_UPDATES;

    handler = async () => {
        if (this.ws.asyncUpdates) {
            clearInterval(this.ws.asyncUpdates);
            console.log("Spotify updates stopped");
        }
    }


}

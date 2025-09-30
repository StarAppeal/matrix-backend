import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import logger from "../../../utils/logger";
import { CurrentlyPlaying } from "../../../interfaces/CurrentlyPlaying";

export class SingleSpotifyUpdateEvent extends CustomWebsocketEvent<CurrentlyPlaying> {
    event = WebsocketEventType.SINGLE_SPOTIFY_UPDATE;

    handler = async (state: CurrentlyPlaying) => {
        logger.debug(`Received spotify update for user ${this.ws.payload.uuid}`);

        this.ws.send(
            JSON.stringify({
                type: "SPOTIFY_UPDATE",
                payload: state,
            }),
            { binary: false }
        );
    };
}

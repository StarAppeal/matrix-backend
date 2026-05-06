import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { WebsocketOutboundType } from "./websocketOutboundType";
import logger from "../../../utils/logger";
import { MusicState } from "../../../interfaces/MusicState";

export class SingleMusicUpdateEvent extends CustomWebsocketEvent<MusicState> {
    event = WebsocketEventType.SINGLE_MUSIC_UPDATE;

    handler = async (state: MusicState) => {
        logger.debug(`Received music update for user ${this.ws.payload.uuid}`);

        this.ws.send(
            JSON.stringify({
                type: WebsocketOutboundType.MUSIC_UPDATE,
                payload: state,
            }),
            { binary: false }
        );
    };
}

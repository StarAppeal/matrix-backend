import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { WebsocketOutboundType } from "./websocketOutboundType";
import logger from "../../../utils/logger";
import { TamagotchiPayload } from "../../../services/db/tamagotchiService";

export class SingleTamagotchiUpdate extends CustomWebsocketEvent<TamagotchiPayload> {
    event = WebsocketEventType.SINGLE_TAMAGOTCHI_UPDATE;

    handler = async (payload: TamagotchiPayload) => {
        logger.debug(`Sending tamagotchi update to user ${this.ws.payload?.username}`);

        this.ws.send(
            JSON.stringify({
                type: WebsocketOutboundType.TAMAGOTCHI_UPDATE,
                payload,
            }),
            { binary: false }
        );
    };
}

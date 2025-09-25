import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { WebsocketEventType } from "./websocketEventType";
import { NoData } from "./NoData";

export class GetSettingsEvent extends CustomWebsocketEvent<NoData> {
    event = WebsocketEventType.GET_SETTINGS;

    handler = async () => {
        console.log("Getting settings");
        this.ws.send(
            JSON.stringify({
                type: "SETTINGS",
                payload: {
                    timezone: this.ws.user.timezone,
                },
            }),
            { binary: false }
        );
    };
}

import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {WebsocketEventType} from "./websocketEventType";

export class GetSettingsEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.GET_SETTINGS;

    handler = async () => {
        console.log("Getting settings");
        this.ws.send(JSON.stringify({
            type: "SETTINGS",
            payload: {
                timezone: this.ws.user.timezone,
            },
        }), {binary: false});
    }
}

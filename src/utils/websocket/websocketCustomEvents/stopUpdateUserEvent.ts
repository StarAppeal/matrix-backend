import {WebsocketEventType} from "./websocketEventType";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {UserAsyncUpdateEvent} from "./updateUserEvent";

export class StopUpdateUserEvent extends CustomWebsocketEvent {

    event = WebsocketEventType.STOP_UPDATE_USER;

    handler = async () => {
        if (this.ws.asyncUpdates.has(UserAsyncUpdateEvent)) {
            clearInterval(this.ws.asyncUpdates.get(UserAsyncUpdateEvent));
            this.ws.asyncUpdates.delete(UserAsyncUpdateEvent);
            console.log("User updates stopped");
        }
    }
}


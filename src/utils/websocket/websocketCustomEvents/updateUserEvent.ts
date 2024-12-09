import {WebsocketEventType} from "./websocketEventType";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {IUser} from "../../../db/models/user";

export class UpdateUserEvent extends CustomWebsocketEvent {
    event = WebsocketEventType.UPDATE_USER;

    handler = async (data: IUser) => {
        console.log("Updating user")
        if (data) {
            this.ws.user = data;
            console.log("User updated")
        }
    }
}


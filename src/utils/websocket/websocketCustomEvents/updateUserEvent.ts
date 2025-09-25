import { WebsocketEventType } from "./websocketEventType";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { IUser } from "../../../db/models/user";

export class UpdateUserSingleEvent extends CustomWebsocketEvent<IUser> {
    event = WebsocketEventType.UPDATE_USER_SINGLE;

    handler = async (data: IUser) => {
        console.log("Updating user");
        if (data) {
            this.ws.user = data;
            console.log("User updated");
        }
    };
}

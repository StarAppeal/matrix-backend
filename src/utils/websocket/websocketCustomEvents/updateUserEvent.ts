import {WebsocketEventType} from "./websocketEventType";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {IUser} from "../../../db/models/user";
import {CustomWebsocketEventUserService} from "./customWebsocketEventUserService";
import {NoData} from "./NoData";

export const UserAsyncUpdateEvent = "USER_UPDATE";

export class UpdateUserEvent extends CustomWebsocketEventUserService<NoData> {
    event = WebsocketEventType.UPDATE_USER;

    handler = async () => {
        console.log("Starting user updates")
        if (this.ws.asyncUpdates.has(UserAsyncUpdateEvent)) {
            console.log("User updates already running");
            return;
        }

        this.ws.asyncUpdates.set(UserAsyncUpdateEvent, setInterval(async () => {
            const user = await this.userService.getUserByUUID(this.ws.payload.uuid);
            this.ws.emit(WebsocketEventType.UPDATE_USER_SINGLE, user);
        }, 1000 * 15));

    }
}

export class UpdateUserSingleEvent extends CustomWebsocketEvent<IUser> {
    event = WebsocketEventType.UPDATE_USER_SINGLE;

    handler = async (data: IUser) => {
        console.log("Updating user")
        if (data) {
            this.ws.user = data;
            console.log("User updated")
        }
    }
}


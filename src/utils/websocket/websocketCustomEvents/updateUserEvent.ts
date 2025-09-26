import { WebsocketEventType } from "./websocketEventType";
import { CustomWebsocketEvent } from "./customWebsocketEvent";
import { IUser } from "../../../db/models/user";
import logger from "../../../utils/logger";

export class UpdateUserSingleEvent extends CustomWebsocketEvent<IUser> {
    event = WebsocketEventType.UPDATE_USER_SINGLE;

    handler = async (data: IUser) => {
        logger.debug(`Updating user ${data?.uuid || "unknown"}`);
        if (data) {
            this.ws.user = data;
            logger.debug(`User ${data.uuid} updated successfully`);
        }
    };
}

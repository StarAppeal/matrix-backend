import {ExtendedWebSocket} from "../../../interfaces/extendedWebsocket";
import {CustomWebsocketEvent} from "./customWebsocketEvent";
import {UserService} from "../../../db/services/db/UserService";

export abstract class CustomWebsocketEventUserService extends CustomWebsocketEvent {
    protected readonly userService: UserService;

    public constructor(ws: ExtendedWebSocket, userService: UserService) {
        super(ws);
        this.userService = userService;
    }

}

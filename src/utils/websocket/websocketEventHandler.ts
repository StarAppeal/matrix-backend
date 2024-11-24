import {ExtendedWebSocket} from "../../interfaces/extendedWebsocket";
import {UserService} from "../../db/services/UserService";

export class WebsocketEventHandler {
    constructor(private webSocket: ExtendedWebSocket) {
    }

    public enableErrorEvent() {
        this.webSocket.on("error", console.error);
    }

    //needed for the heartbeat mechanism
    public enablePongEvent() {
        this.webSocket.on("pong", () => {
            this.webSocket.isAlive = true;
            console.log("Pong received");
        });
    }

    public enableDisconnectEvent() {
        this.webSocket.onclose = (event) => {
            console.log("WebSocket closed:", event.code, event.reason, event.wasClean, event.type);
            console.log(`User: ${this.webSocket.payload.name} disconnected`);
        };
    }

    public enableMessageEvent() {
        this.webSocket.on("message", async (data) => {
            const message = data.toString();
            console.log("Received message:", message);

            if (message === "GET_STATE") {
                const userService = await UserService.create();

                const user = await userService.getUserByUUID(this.webSocket.payload._id);

                this.webSocket.send(JSON.stringify(user?.lastState), {binary: false});
            }
        });
    }
}

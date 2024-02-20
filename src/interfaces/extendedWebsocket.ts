import { WebSocket } from "ws";
import { DecodedToken } from "./decodedToken";

export interface ExtendedWebSocket extends WebSocket {
  payload: DecodedToken;
  isAlive: boolean;
}

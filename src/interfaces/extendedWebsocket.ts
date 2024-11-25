import { WebSocket } from "ws";
import { DecodedToken } from "./decodedToken";
import {IUser} from "../db/models/user";

export interface ExtendedWebSocket extends WebSocket {
  payload: DecodedToken;
  isAlive: boolean;
  user:IUser;
  asyncUpdates?: NodeJS.Timeout
}

import { IncomingMessage } from "node:http";
import { DecodedToken } from "./decodedToken";

export interface ExtendedIncomingMessage extends IncomingMessage {
  payload: DecodedToken;
}

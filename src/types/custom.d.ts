import { DecodedToken } from "../interfaces/decodedToken";

declare global {
  declare namespace Express {
    export interface Request {
      payload: DecodedToken;
    }
  }
}

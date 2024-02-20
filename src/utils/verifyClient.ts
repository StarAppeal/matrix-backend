import "dotenv/config";

import { IncomingMessage } from "node:http";
import jwt from "jsonwebtoken";
import { DecodedToken } from "../interfaces/decodedToken";
import { ExtendedIncomingMessage } from "../interfaces/extendedIncomingMessage";

export function verifyClient(
  request: IncomingMessage,
  callback: (res: boolean, code?: number, message?: string) => void,
) {
  const token = request.headers["authorization"];

  if (!token) {
    reject(request, callback);
  } else {
    jwt.verify(token, process.env.SECRET_KEY as string, (err, decoded) => {
      if (err) {
        console.log(err);
        reject(request, callback);
      } else {
        (request as ExtendedIncomingMessage).payload = decoded as DecodedToken;
        callback(true);
      }
    });
  }
}

const reject = (
  request: IncomingMessage,
  callback: (res: boolean, code?: number, message?: string) => void,
) => {
  console.log(
    "Connection refused",
    `${request.socket.remoteAddress}:${request.socket.remotePort}`,
  );
  callback(false, 401, "Unauthorized");
};

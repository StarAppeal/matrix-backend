import "dotenv/config";

import {IncomingMessage} from "node:http";
import {ExtendedIncomingMessage} from "../interfaces/extendedIncomingMessage";
import {JwtAuthenticator} from "./jwtAuthenticator";

export function verifyClient(
    request: IncomingMessage,
    callback: (res: boolean, code?: number, message?: string) => void,
) {
  const jwtAuthenticator = new JwtAuthenticator(
      process.env.SECRET_KEY as string,
  );

  const token = jwtAuthenticator.verifyToken(request.headers["authorization"]?.slice("Bearer ".length));
  if (!token) {
    reject(request, callback);
  } else {
    (request as ExtendedIncomingMessage).payload = token;
    callback(true);
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

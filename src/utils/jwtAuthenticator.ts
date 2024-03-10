import jwt from "jsonwebtoken";
import { DecodedToken } from "../interfaces/decodedToken";

export class JwtAuthenticator {
  constructor(private secret: string) {}

  public verifyToken(token: string | undefined): DecodedToken | null {
    if (!token) {
      return null;
    }

    try {
      return jwt.verify(token, this.secret) as DecodedToken;
    } catch (error) {
      console.error("Error while verifying token:", error);
    }

    return null;
  }
}

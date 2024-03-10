import { JwtAuthenticator } from "../../utils/jwtAuthenticator";
import { Request, Response, NextFunction } from "express";

export function authenticateJwt(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers["authorization"];

  const jwtAuthenticator = new JwtAuthenticator(
    process.env.SECRET_KEY as string,
  );
  const decodedToken = jwtAuthenticator.verifyToken(token);
  if (!decodedToken) {
    return res.status(401).send("Unauthorized");
  }

  req.payload = decodedToken;
  next();
}

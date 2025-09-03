import {JwtAuthenticator} from "../../utils/jwtAuthenticator";
import {Request, Response, NextFunction} from "express";

export function authenticateJwt(
    req: Request,
    res: Response,
    next: NextFunction,
) {
  //remove Bearer from the beginning of the token
  const token = req.headers["authorization"]?.slice("Bearer ".length);

  console.log(token);

  const jwtAuthenticator = new JwtAuthenticator(
      process.env.SECRET_KEY as string,
  );

    console.log(process.env.SECRET_KEY)

  const decodedToken = jwtAuthenticator.verifyToken(token);
    console.log(decodedToken)
  if (!decodedToken) {
    return res.status(401).send("Unauthorized");
  }

  req.payload = decodedToken;
  next();
}

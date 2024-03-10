import express from "express";

export class JwtTokenPropertiesExtractor {
  public createRouter() {
    const router = express.Router();

    router.get("/_id", (req, res) => {
      res.status(200).send(req.payload._id);
    });

    return router;
  }
}

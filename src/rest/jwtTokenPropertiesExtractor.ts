import express from "express";

export class JwtTokenPropertiesExtractor {
    public createRouter() {
        const router = express.Router();

        router.get("/id", (req, res) => {
            res.status(200).send(req.payload.id);
        });

        router.get("/username", (req, res) => {
            res.status(200).send(req.payload.username);
        });

        router.get("/uuid", (req, res) => {
            res.status(200).send(req.payload.uuid);
        });


        return router;
    }
}

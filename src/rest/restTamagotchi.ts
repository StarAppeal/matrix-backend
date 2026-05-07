import express from "express";
import { asyncHandler } from "./middleware/asyncHandler";
import { badRequest, ok } from "./utils/responses";
import { TamagotchiService } from "../services/db/tamagotchiService";

export class RestTamagotchi {
    constructor(private readonly tamagotchiService: TamagotchiService) {}

    public createRouter() {
        const router = express.Router();

        router.get(
            "/",
            asyncHandler(async (req, res) => {
                const pet = await this.tamagotchiService.getOrEvaluatePet(req.payload.uuid);
                return ok(res, TamagotchiService.toPayload(pet));
            })
        );

        router.post(
            "/feed",
            asyncHandler(async (req, res) => {
                if (this.tamagotchiService.isBusy(req.payload.uuid)) {
                    return badRequest(res, "Pet is currently busy");
                }
                const payload = await this.tamagotchiService.feed(req.payload.uuid);
                return ok(res, payload);
            })
        );

        router.post(
            "/play",
            asyncHandler(async (req, res) => {
                if (this.tamagotchiService.isBusy(req.payload.uuid)) {
                    return badRequest(res, "Pet is currently busy");
                }
                const payload = await this.tamagotchiService.play(req.payload.uuid);
                return ok(res, payload);
            })
        );

        router.post(
            "/clean",
            asyncHandler(async (req, res) => {
                if (this.tamagotchiService.isBusy(req.payload.uuid)) {
                    return badRequest(res, "Pet is currently busy");
                }
                const payload = await this.tamagotchiService.clean(req.payload.uuid);
                return ok(res, payload);
            })
        );

        router.post(
            "/awake",
            asyncHandler(async (req, res) => {
                const uuid = req.payload.uuid;
                if (this.tamagotchiService.isBusy(uuid)) {
                    return badRequest(res, "Pet is currently busy");
                }

                const payload = await this.tamagotchiService.awake(uuid);

                return ok(res, payload);
            })
        );

        router.post(
            "/sleep",
            asyncHandler(async (req, res) => {
                const uuid = req.payload.uuid;
                if (this.tamagotchiService.isBusy(uuid)) {
                    return badRequest(res, "Pet is currently busy");
                }

                const payload = await this.tamagotchiService.sleep(uuid);
                return ok(res, payload);
            })
        );

        return router;
    }
}

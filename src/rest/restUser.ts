import express from "express";
import {UserService} from "../db/services/db/UserService";
import {PasswordUtils} from "../utils/passwordUtils";

export class RestUser {
    public createRouter() {
        const router = express.Router();

        router.get("/", async (req, res) => {
            const userService = await UserService.create();
            const users = await userService.getAllUsers();
            res.status(200).send({users});
        });

        router.get("/me", async (req, res) => {
            const userService = await UserService.create();
            const user = await userService.getUserByUUID(req.payload.uuid);
            res.status(200).send(user);
        });

        router.put("/me/spotify", async (req, res) => {
            const userService = await UserService.create();
            const user = await userService.getUserByUUID(req.payload.uuid);
            user!.spotifyConfig = req.body;
            userService.updateUser(user!)
                .then(() => {
                    res.status(200).send({result: {success: true, message: "Spotify Config erfolgreich geändert"}});
                });
        });

        router.put("/me/password", async (req, res) => {
            const userService = await UserService.create();
            const user = await userService.getUserByUUID(req.payload.uuid);
            const password = req.body.password;
            const passwordConfirmation = req.body.passwordConfirmation;

            if (password !== passwordConfirmation) {
                res.status(400).send({
                    result: {
                        success: false,
                        message: "Passwörter stimmen nicht überein"
                    }
                });
                return;
            }

            const passwordValidation = PasswordUtils.validatePassword(password);

            if (!passwordValidation.valid) {
                res.status(400).send({result: passwordValidation});
                return;
            }

            PasswordUtils.hashPassword(password).then(hashedPassword => {
                user!.password = hashedPassword;
                userService.updateUser(user!)
                    .then(() => {
                        res.status(200).send({result: {success: true, message: "Passwort erfolgreich geändert"}});
                    });
            });
        });

        router.get("/:id", async (req, res) => {
            const userService = await UserService.create();
            const id = req.params.id;
            const user = await userService.getUserById(id);

            user
                ? res.status(200).send(user)
                : res
                    .status(404)
                    .send(`Unable to find matching document with id: ${req.params.id}`);
        });

        return router;
    }
}

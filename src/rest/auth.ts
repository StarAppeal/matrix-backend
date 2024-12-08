import express from "express";
import {UserService} from "../db/services/db/UserService";
import {IUser} from "../db/models/user";
import {ObjectId} from "mongodb";
import {JwtAuthenticator} from "../utils/jwtAuthenticator";
import crypto from "crypto"
import {PasswordUtils} from "../utils/passwordUtils";

export class RestAuth {
    public createRouter() {
        const router = express.Router();

        router.post("/register", async (req, res) => {
            const username = req.body.username;
            const timezone = req.body.timezone;
            const location = req.body.location;
            const password = req.body.password;
            const userService = await UserService.create();

            if (await userService.existsUserByName(username)) {
                res.status(409).send({message: "Username already exists"});
                return;
            }

            const passwordValidation = PasswordUtils.validatePassword(password);

            if (!passwordValidation.valid) {
                res.status(400).send({success: false, message: passwordValidation.message});
                return;
            }

            const hashedPassword = await PasswordUtils.hashPassword(password);
            const newUser: IUser = {
                id: ObjectId.createFromTime(Date.now()),
                name: username,
                password: hashedPassword,
                uuid: crypto.randomUUID(),
                config: {
                    isVisible: false,
                    isAdmin: false,
                    canBeModified: false
                },
                timezone,
                location
            };
            const result = await userService.createUser(newUser);
            res.status(201).send({success: true, user: result});
        });

        router.post("/login", async (req, res) => {
            const username = req.body.username;
            const password = req.body.password;
            const userService = await UserService.create();
            const user = await userService.getUserByName(username);

            if (!user) {
                res.status(404).send({success: false, message: "User not found", id: "username"});
                return;
            }

            const isValid = await PasswordUtils.comparePassword(password, user.password!);

            if (!isValid) {
                res.status(401).send({success: false, message: "Invalid password", id: "password"});
                return;
            }

            // generate JWT token here
            const jwtToken = new JwtAuthenticator(
                process.env.SECRET_KEY!,
            ).generateToken({username: user.name, id: user.id.toString(), uuid: user.uuid});

            res.status(200).send({success: true, token: jwtToken});
        });


        return router;
    }
}

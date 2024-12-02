import express from "express";
import {UserService} from "../db/services/db/UserService";
import {IUser} from "../db/models/user";
import {ObjectId} from "mongodb";
import {JwtAuthenticator} from "../utils/jwtAuthenticator";
import bcrypt from "bcrypt";

export class RestAuth {
    public createRouter() {
        const router = express.Router();

        router.put("/register", async (req, res) => {
            const username = req.body.username;
            const timezone = req.body.timezone;
            const location = req.body.location;
            const password = req.body.password;
            const userService = await UserService.create();
            const user = await userService.getUserByName(username);

            if (user) {
                res.status(409).send({message: "Username already exists"});
            } else {
                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser: IUser = {
                    name: username,
                    password: hashedPassword,
                    uuid: crypto.randomUUID(),
                    id: ObjectId.createFromTime(Date.now()),
                    config: {
                        isVisible: false,
                        isAdmin: false,
                        canBeModified: false
                    },
                    timezone,
                    location
                };
                const result = await userService.createUser(newUser);
                result.password = undefined;
                res.status(201).send({success: true, user: result});
            }
        });

        router.post("/login", async (req, res) => {
            const username = req.body.username;
            const password = req.body.password;
            const userService = await UserService.create();
            const user = await userService.getUserByName(username);

            if (!user) {
                res.status(404).send({success: false, message: "User not found"});
                return;
            }

            const isValid = await bcrypt.compare(password, user.password!);

            if (!isValid) {
                res.status(401).send({success: false, message: "Invalid password"});
                return;
            }

            // generate JWT token here
            const jwtToken = new JwtAuthenticator(
                process.env.SECRET_KEY!,
            ).generateToken({username: user.name, id: user.id, uuid: user.uuid});

            res.status(200).send({success: true, token: jwtToken});
        });


        return router;
    }
}
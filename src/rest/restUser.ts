import express from "express";
import {UserService} from "../db/services/UserService";
import {IUser} from "../db/models/user";

export class RestUser {
  public createRouter() {
    const router = express.Router();

    router.get("/", async (req, res) => {
      const userService = await UserService.create();
      const users = await userService.getAllUsers();
      res.status(200).send({ users });
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

    router.put("/:id", async (req, res) => {
      const userService = await UserService.create();
      const id = req.params.id;
      const user = req.body as IUser;
      const result = await userService.updateUser(id, user);

      result
        ? res.status(200).send(result)
        : res.status(304).send("Not Modified");
    });

    return router;
  }
}

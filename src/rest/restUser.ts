import { UserService } from "../db/services/database.service";
import express from "express";

export class RestUser {
  constructor(private callback: () => Promise<UserService>) {}

  public createRouter() {
    const router = express.Router();

    router.get("/", async (req, res) => {
      const userService = await this.callback();
      const users = await userService.getAllUsers();
      res.status(200).send(users);
    });

    router.get("/:id", async (req, res) => {
      const userService = await this.callback();
      const id = req.params.id;
      const user = await userService.getUserById(id);

      user
        ? res.status(200).send(user)
        : res
            .status(404)
            .send(`Unable to find matching document with id: ${req.params.id}`);
    });

    router.post("/", async (req, res) => {
      const userService = await this.callback();
      const { name, uuid } = req.body;
      const result = await userService.createUser(name, uuid);

      result
        ? res
            .status(201)
            .send(
              `Successfully created a new user with id ${result.insertedId}`,
            )
        : res.status(500).send("Failed to create a new game.");
    });

    return router;
  }
}

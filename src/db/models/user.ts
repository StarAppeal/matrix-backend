import { ObjectId } from "mongodb";

export default class User {
  constructor(
    public name: string,
    public uuid: string,
    public id: ObjectId,
  ) {}
}

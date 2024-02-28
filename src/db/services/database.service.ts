import "dotenv/config";

import * as mongoDB from "mongodb";
import User from "../models/user";
import { ObjectId, ReturnDocument } from "mongodb";

let mongoDb: mongoDB.Db;

async function getDatabase(): Promise<mongoDB.Db> {
  if (mongoDb) {
    return mongoDb;
  }
  const client = new mongoDB.MongoClient(process.env.DB_CONN_STRING!);
  await client.connect();
  mongoDb = client.db(process.env.DB_NAME!);
  return mongoDb;
}

export class UserService {
  private readonly collection: mongoDB.Collection;
  private static _instance: UserService;

  private constructor(db: mongoDB.Db) {
    this.collection = db.collection(process.env.USER_COLLECTION_NAME!);
  }

  public static async create(): Promise<UserService> {
    if (this._instance) {
      return this._instance;
    }
    const db = await getDatabase();
    this._instance = new UserService(db);
    return this._instance;
  }

  public async updateUser(id: string, user: User): Promise<User> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: user },
      { returnDocument: ReturnDocument.AFTER },
    );
    return result as unknown as User;
  }

  public async getAllUsers(): Promise<User[]> {
    return (await this.collection.find().toArray()) as unknown as User[];
  }

  async getUserById(id: string) {
    try {
      return (await this.collection.findOne({
        _id: new ObjectId(id),
      })) as unknown as User;
    } catch (e) {
      // TODO: implement proper logging
      console.error(e);
      return null;
    }
  }
}

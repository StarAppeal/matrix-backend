import { IUser, UserModel } from "./user";
import { appEventBus, USER_UPDATED_EVENT } from "../../utils/eventBus";
import logger from "../../utils/logger";
import { ChangeStreamDocument } from "mongodb";

export function watchUserChanges() {
    const changeStream = UserModel.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change: ChangeStreamDocument<IUser>) => {
        switch (change.operationType) {
            case "update":
            case "replace":
                if (change.fullDocument) {
                    appEventBus.emit(USER_UPDATED_EVENT, change.fullDocument);
                }
                break;
        }
    });

    logger.info("User collection change stream initialized - watching for database updates");
}

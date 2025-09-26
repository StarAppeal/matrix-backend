import { UserModel } from "./user";
import { appEventBus, USER_UPDATED_EVENT } from "../../utils/eventBus";
import logger from "../../utils/logger";

export function watchUserChanges() {
    const changeStream = UserModel.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change: any) => {
        if (change.operationType === "update" && change.fullDocument) {
            const updatedUser = change.fullDocument;

            appEventBus.emit(USER_UPDATED_EVENT, updatedUser);
        }
    });

    logger.info("User collection change stream initialized - watching for database updates");
}

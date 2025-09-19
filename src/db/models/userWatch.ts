import { UserModel } from './user';
import {appEventBus, USER_UPDATED_EVENT} from "../../utils/eventBus";

export function watchUserChanges() {
    const changeStream = UserModel.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', (change) => {
        if (change.operationType === 'update' && change.fullDocument) {
            const updatedUser = change.fullDocument;

            appEventBus.emit(USER_UPDATED_EVENT, updatedUser);
        }
    });

    console.log("Watching for changes in the User collection...");
}

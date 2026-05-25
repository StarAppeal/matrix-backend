import { appEventBus } from "../../utils/eventBus";
import { ExtendedWebSocketServer } from "../../websocket";
import logger from "../../utils/logger";

export abstract class BaseEventListener<T> {
    protected constructor(
        protected readonly wss: ExtendedWebSocketServer,
        private readonly eventName: string
    ) {
        this.setupListener();
    }

    private setupListener(): void {
        appEventBus.on(this.eventName, async (payload: T) => {
            try {
                await this.handleEvent(payload);
            } catch (err) {
                logger.error(`Error in event listener for "${this.eventName}":`, err);
            }
        });
    }

    protected abstract handleEvent(payload: T): void | Promise<void>;
}

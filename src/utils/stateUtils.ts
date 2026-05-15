import { S3Service } from "../services/s3Service";
import { MatrixState } from "../db/models/user";
import logger from "./logger";

const DEFAULT_STATE = {
    global: {
        mode: "idle",
        brightness: 100,
    },
};

export class StateUtils {
    private readonly state: MatrixState;

    constructor(state: MatrixState) {
        this.state = state;
    }

    public async hydrate(s3Service: S3Service) {
        if (!this.state) return DEFAULT_STATE;

        const state = JSON.parse(JSON.stringify(this.state)) as MatrixState;

        if (state.global?.mode === "image" && state.image?.s3_key) {
            try {
                state.image.image_url = await s3Service.getSignedDownloadUrl(state.image.s3_key, 60, "matrix64");
            } catch (e) {
                logger.error(`Failed to generate S3 URL for key ${state.image.s3_key}`, e);
            }
        }
        return state;
    }
}

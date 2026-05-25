import sharp from "sharp";
import { HttpClient } from "../utils/httpClient";
import { CacheService } from "./cacheService";

export enum TargetMode {
    ImageMode = 0x01,
    MusicMode = 0x02,
}

export enum PayloadType {
    COMPRESSED_IMAGE = 0x01,
    COMPRESSED_GIF = 0x02,
}

export type ImageFitMode = "contain" | "cover" | "fill";

export class ImageService {
    private readonly isGif: boolean;

    constructor(
        private readonly buffer: Buffer,
        private readonly cacheKey?: string,
        private readonly cacheService?: CacheService,
        private readonly ttl?: number
    ) {
        this.isGif = buffer.length > 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // GIF
    }

    async toMatrixBinaryFrame(
        targetMode: TargetMode,
        width: number,
        height: number,
        fit?: ImageFitMode
    ): Promise<Buffer> {
        const fitMode = fit ?? "contain";

        const computeFn = async () => {
            let payload: Buffer;
            let payloadType: PayloadType;

            if (this.isGif) {
                payloadType = PayloadType.COMPRESSED_GIF;

                payload = await sharp(this.buffer, { pages: -1 })
                    .resize(width, height, { fit: fitMode })
                    .gif()
                    .toBuffer();
            } else {
                payloadType = PayloadType.COMPRESSED_IMAGE;

                payload = await sharp(this.buffer)
                    .resize(width, height, { fit: fitMode })
                    .png({ palette: true, quality: 80 })
                    .toBuffer();
            }

            const header = Buffer.alloc(8);
            header.writeUInt32BE(payload.length, 0);
            header.writeUInt8(targetMode, 4);
            header.writeUInt8(payloadType, 5);
            header.writeUInt8(width, 6);
            header.writeUInt8(height, 7);

            return Buffer.concat([header, payload]);
        };

        if (this.cacheKey && this.cacheService && this.ttl !== undefined) {
            const key = `${this.cacheKey}:${targetMode}:${width}:${height}:${fitMode}`;
            return this.cacheService.getOrSet(key, this.ttl, computeFn);
        }

        return computeFn();
    }
}

export class ImageServiceFactory {
    private readonly ttl = 5 * 60 * 1000;

    constructor(
        private readonly httpClient: HttpClient,
        private readonly cacheService: CacheService
    ) { }

    fromBuffer(buffer: Buffer, cacheKey?: string): ImageService {
        return new ImageService(buffer, cacheKey, this.cacheService, this.ttl);
    }

    async fromUrl(url: string): Promise<ImageService> {
        const arrayBuffer = await this.httpClient.get<ArrayBuffer>(url, {
            responseType: "arraybuffer",
        });

        return new ImageService(Buffer.from(arrayBuffer), url, this.cacheService, this.ttl);
    }
}

import {DecodedToken} from "../interfaces/decodedToken";

declare global {
    declare namespace Express {
        export interface Request {
            payload: DecodedToken;
            file?: Multer.File;
        }

        namespace Multer {
            export interface File {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                size: number;
                destination: string;
                filename: string;
                path: string;
                buffer: Buffer;
            }
        }
    }
}

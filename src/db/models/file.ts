import mongoose from "mongoose";

export interface File {
    _id: mongoose.Types.ObjectId;
    userId: string; // UUID des Benutzers statt MongoDB ObjectId
    objectKey: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
}

const fileSchema = new mongoose.Schema<File>(
    {
        userId: {
            type: String,
            required: true,
        },
        objectKey: {
            type: String,
            required: true,
            unique: true,
        },
        originalName: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

fileSchema.index({ userId: 1 });

export const FileModel = mongoose.model<File>("File", fileSchema);

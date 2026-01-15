import { v2 as cloudinary } from 'cloudinary';
export interface UploadResult {
    url: string;
    publicId: string;
    format: string;
    bytes: number;
}
export declare const uploadImage: (buffer: Buffer, folder?: string) => Promise<UploadResult>;
export declare const uploadFile: (buffer: Buffer, originalName: string, folder?: string) => Promise<UploadResult>;
export declare const getSignedDownloadUrl: (publicId: string, expiresInSeconds?: number) => string;
export declare const deleteFile: (publicId: string, resourceType?: "image" | "raw") => Promise<void>;
export default cloudinary;
//# sourceMappingURL=cloudinary.service.d.ts.map
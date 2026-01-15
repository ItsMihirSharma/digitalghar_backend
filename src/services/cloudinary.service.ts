import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
    url: string;
    publicId: string;
    format: string;
    bytes: number;
}

// Upload image (public)
export const uploadImage = async (
    buffer: Buffer,
    folder: string = 'digitalghar/images'
): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                transformation: [
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error('Upload failed'));
                } else {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format,
                        bytes: result.bytes,
                    });
                }
            }
        );

        const stream = Readable.from(buffer);
        stream.pipe(uploadStream);
    });
};

// Upload file (private/authenticated)
export const uploadFile = async (
    buffer: Buffer,
    originalName: string,
    folder: string = 'digitalghar/products'
): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'raw',
                access_mode: 'authenticated', // Private file
                public_id: originalName.replace(/\.[^/.]+$/, ''), // Remove extension
            },
            (error, result) => {
                if (error || !result) {
                    reject(error || new Error('Upload failed'));
                } else {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format || 'raw',
                        bytes: result.bytes,
                    });
                }
            }
        );

        const stream = Readable.from(buffer);
        stream.pipe(uploadStream);
    });
};

// Generate signed download URL (expires in 1 hour)
export const getSignedDownloadUrl = (
    publicId: string,
    expiresInSeconds: number = 3600
): string => {
    const expireAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    return cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
        sign_url: true,
        expires_at: expireAt,
    });
};

// Delete file
export const deleteFile = async (publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> => {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export default cloudinary;

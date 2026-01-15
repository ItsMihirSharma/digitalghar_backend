"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getSignedDownloadUrl = exports.uploadFile = exports.uploadImage = void 0;
const cloudinary_1 = require("cloudinary");
const stream_1 = require("stream");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Upload image (public)
const uploadImage = async (buffer, folder = 'digitalghar/images') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: 'image',
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        }, (error, result) => {
            if (error || !result) {
                reject(error || new Error('Upload failed'));
            }
            else {
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format,
                    bytes: result.bytes,
                });
            }
        });
        const stream = stream_1.Readable.from(buffer);
        stream.pipe(uploadStream);
    });
};
exports.uploadImage = uploadImage;
// Upload file (private/authenticated)
const uploadFile = async (buffer, originalName, folder = 'digitalghar/products') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder,
            resource_type: 'raw',
            access_mode: 'authenticated', // Private file
            public_id: originalName.replace(/\.[^/.]+$/, ''), // Remove extension
        }, (error, result) => {
            if (error || !result) {
                reject(error || new Error('Upload failed'));
            }
            else {
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    format: result.format || 'raw',
                    bytes: result.bytes,
                });
            }
        });
        const stream = stream_1.Readable.from(buffer);
        stream.pipe(uploadStream);
    });
};
exports.uploadFile = uploadFile;
// Generate signed download URL (expires in 1 hour)
const getSignedDownloadUrl = (publicId, expiresInSeconds = 3600) => {
    const expireAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary_1.v2.url(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
        sign_url: true,
        expires_at: expireAt,
    });
};
exports.getSignedDownloadUrl = getSignedDownloadUrl;
// Delete file
const deleteFile = async (publicId, resourceType = 'image') => {
    await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
};
exports.deleteFile = deleteFile;
exports.default = cloudinary_1.v2;
//# sourceMappingURL=cloudinary.service.js.map
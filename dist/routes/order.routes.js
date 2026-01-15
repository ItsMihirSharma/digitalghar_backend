"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const redis_1 = __importDefault(require("../utils/redis"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const upi_service_1 = require("../services/upi.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const router = (0, express_1.Router)();
// Helper to get string from query param
const getQueryString = (param) => {
    if (typeof param === 'string')
        return param;
    if (Array.isArray(param) && typeof param[0] === 'string')
        return param[0];
    return undefined;
};
// Create order (from cart)
router.post('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const userEmail = req.user.email;
        // Get cart items
        const cartKey = `cart:user:${userId}`;
        const cartData = await redis_1.default.get(cartKey);
        if (!cartData) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        const productIds = JSON.parse(cartData);
        if (productIds.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        // Get products
        const products = await prisma_1.default.product.findMany({
            where: {
                id: { in: productIds },
                isActive: true,
            },
        });
        if (products.length === 0) {
            return res.status(400).json({ error: 'No valid products in cart' });
        }
        // Calculate total
        const totalAmount = products.reduce((sum, p) => sum + Number(p.price), 0);
        // Generate order number
        const orderNumber = (0, upi_service_1.generateOrderNumber)();
        // Create order with items
        const order = await prisma_1.default.order.create({
            data: {
                orderNumber,
                userId,
                userEmail,
                totalAmount,
                items: {
                    create: products.map(p => ({
                        productId: p.id,
                        productTitle: p.title,
                        productPrice: p.price,
                        downloadLimit: 5,
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { title: true, imageUrl: true },
                        },
                    },
                },
            },
        });
        // Generate UPI QR code
        const upiQrCode = await (0, upi_service_1.generateUPIQRCode)({
            upiId: process.env.UPI_ID || 'merchant@upi',
            name: process.env.UPI_NAME || 'DigitalGhar',
            amount: totalAmount,
            orderId: orderNumber,
        });
        // Clear cart
        await redis_1.default.del(cartKey);
        res.status(201).json({
            message: 'Order created',
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                items: order.items,
                paymentStatus: order.paymentStatus,
            },
            payment: {
                upiId: process.env.UPI_ID || 'merchant@upi',
                amount: totalAmount,
                qrCode: upiQrCode,
                note: `Order: ${orderNumber}`,
            },
        });
    }
    catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});
// Submit UTR (payment reference)
const submitUtrSchema = zod_1.z.object({
    utrNumber: zod_1.z.string().min(5).max(50),
});
router.post('/:orderId/submit-utr', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const orderId = getQueryString(req.params.orderId);
        if (!orderId) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }
        const { utrNumber } = submitUtrSchema.parse(req.body);
        const userId = req.user.id;
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
                paymentStatus: 'PENDING',
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found or already processed' });
        }
        // Update order with UTR
        await prisma_1.default.order.update({
            where: { id: orderId },
            data: {
                utrNumber,
                paymentStatus: 'SUBMITTED',
            },
        });
        res.json({
            message: 'Payment reference submitted. We will verify and enable your downloads shortly.',
            orderNumber: order.orderNumber,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Invalid UTR number' });
        }
        console.error('Submit UTR error:', error);
        res.status(500).json({ error: 'Failed to submit payment reference' });
    }
});
// Get user's orders
router.get('/my', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const orders = await prisma_1.default.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { title: true, imageUrl: true, slug: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ orders });
    }
    catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});
// Get order details
router.get('/:orderId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const orderId = getQueryString(req.params.orderId);
        if (!orderId) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }
        const userId = req.user.id;
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { title: true, imageUrl: true, slug: true, fileUrl: true },
                        },
                    },
                },
            },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Generate UPI QR if still pending
        let upiQrCode = null;
        if (order.paymentStatus === 'PENDING') {
            upiQrCode = await (0, upi_service_1.generateUPIQRCode)({
                upiId: process.env.UPI_ID || 'merchant@upi',
                name: process.env.UPI_NAME || 'DigitalGhar',
                amount: Number(order.totalAmount),
                orderId: order.orderNumber,
            });
        }
        res.json({
            order,
            payment: order.paymentStatus === 'PENDING' ? {
                upiId: process.env.UPI_ID || 'merchant@upi',
                amount: order.totalAmount,
                qrCode: upiQrCode,
            } : null,
        });
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
// Download file
router.get('/download/:orderItemId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const orderItemId = getQueryString(req.params.orderItemId);
        if (!orderItemId) {
            return res.status(400).json({ error: 'Invalid order item ID' });
        }
        const userId = req.user.id;
        const orderItem = await prisma_1.default.orderItem.findFirst({
            where: {
                id: orderItemId,
                order: {
                    userId,
                    paymentStatus: 'VERIFIED',
                },
            },
            include: {
                order: true,
                product: {
                    select: { fileUrl: true },
                },
            },
        });
        if (!orderItem) {
            return res.status(404).json({ error: 'Download not available' });
        }
        // Check download limits
        if (orderItem.downloadCount >= orderItem.downloadLimit) {
            return res.status(403).json({ error: 'Download limit reached' });
        }
        // Check expiry
        if (orderItem.expiresAt && new Date() > orderItem.expiresAt) {
            return res.status(403).json({ error: 'Download link expired' });
        }
        // Generate signed URL
        const downloadUrl = (0, cloudinary_service_1.getSignedDownloadUrl)(orderItem.product.fileUrl, 3600);
        // Increment download count and log
        await Promise.all([
            prisma_1.default.orderItem.update({
                where: { id: orderItemId },
                data: { downloadCount: { increment: 1 } },
            }),
            prisma_1.default.downloadLog.create({
                data: {
                    userId,
                    orderItemId,
                    productId: orderItem.productId,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                },
            }),
            prisma_1.default.product.update({
                where: { id: orderItem.productId },
                data: { downloadCount: { increment: 1 } },
            }),
        ]);
        res.json({
            downloadUrl,
            remainingDownloads: orderItem.downloadLimit - orderItem.downloadCount - 1,
            productTitle: orderItem.productTitle,
        });
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to generate download link' });
    }
});
exports.default = router;
//# sourceMappingURL=order.routes.js.map
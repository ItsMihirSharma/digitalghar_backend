import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import prisma from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.middleware';
import { uploadImage, uploadFile, deleteFile } from '../services/cloudinary.service';
import { getSignedDownloadUrl } from '../services/cloudinary.service';

const router = Router();

// Apply auth + admin check to all routes
router.use(authenticate, requireAdmin);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Helper to get string from query param
const getQueryString = (param: unknown): string | undefined => {
    if (typeof param === 'string') return param;
    if (Array.isArray(param) && typeof param[0] === 'string') return param[0];
    return undefined;
};

// ==================== DASHBOARD ====================


router.get('/dashboard', async (req: AuthRequest, res: Response) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [
            totalProducts,
            activeProducts,
            totalOrders,
            pendingOrders,
            completedOrders,
            totalUsers,
            thisMonthRevenue,
            lastMonthRevenue,
            recentOrders,
        ] = await Promise.all([
            prisma.product.count(),
            prisma.product.count({ where: { isActive: true } }),
            prisma.order.count(),
            prisma.order.count({ where: { paymentStatus: 'PENDING' } }),
            prisma.order.count({ where: { paymentStatus: 'VERIFIED' } }),
            prisma.user.count({ where: { role: 'CUSTOMER' } }),
            prisma.order.aggregate({
                where: { paymentStatus: 'VERIFIED', createdAt: { gte: startOfMonth } },
                _sum: { totalAmount: true },
            }),
            prisma.order.aggregate({
                where: {
                    paymentStatus: 'VERIFIED',
                    createdAt: { gte: startOfLastMonth, lt: startOfMonth },
                },
                _sum: { totalAmount: true },
            }),
            prisma.order.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { name: true, email: true } },
                    _count: { select: { items: true } },
                },
            }),
        ]);

        res.json({
            stats: {
                products: { total: totalProducts, active: activeProducts },
                orders: { total: totalOrders, pending: pendingOrders, completed: completedOrders },
                users: totalUsers,
                revenue: {
                    thisMonth: thisMonthRevenue._sum.totalAmount || 0,
                    lastMonth: lastMonthRevenue._sum.totalAmount || 0,
                },
            },
            recentOrders,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ==================== PRODUCTS ====================

// Get all products (admin view)
router.get('/products', async (req: AuthRequest, res: Response) => {
    try {
        const page = getQueryString(req.query.page) || '1';
        const limit = getQueryString(req.query.limit) || '20';
        const search = getQueryString(req.query.search);
        const category = getQueryString(req.query.category);
        const status = getQueryString(req.query.status);

        const where: any = {};

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (category) {
            where.categoryId = category;
        }

        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: { category: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma.product.count({ where }),
        ]);

        res.json({
            products,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Create product schema
const createProductSchema = z.object({
    title: z.string().min(3).max(255),
    slug: z.string().min(3).max(255).optional(),
    shortDescription: z.string().min(10).max(500),
    longDescription: z.string().optional(), // Made optional
    categoryId: z.string().uuid(),
    price: z.number().positive(),
    originalPrice: z.number().positive().optional(),
    productType: z.enum(['PDF', 'VIDEO', 'COURSE', 'TEMPLATE', 'PLR', 'OTHER']),
    ageGroup: z.string().optional(),
    licenseType: z.enum(['PERSONAL', 'PLR', 'MRR']).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
});

// Create product
router.post('/products', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
    try {
        console.log('📦 Received product creation request');
        console.log('Body data:', req.body.data);

        const parsedData = JSON.parse(req.body.data || '{}');
        console.log('Parsed data:', parsedData);

        const data = createProductSchema.parse(parsedData);
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // Generate slug if not provided
        const slug = data.slug || data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Check slug uniqueness
        const existingSlug = await prisma.product.findUnique({ where: { slug } });
        if (existingSlug) {
            return res.status(400).json({ error: 'Slug already exists' });
        }

        // Upload image (optional if Cloudinary not configured)
        let imageUrl = '';
        if (files.image && files.image[0]) {
            try {
                const imageResult = await uploadImage(files.image[0].buffer, 'digitalghar/images');
                imageUrl = imageResult.url;
            } catch (uploadError) {
                console.warn('⚠️ Cloudinary not configured, skipping image upload');
            }
        }

        // Upload file (optional if Cloudinary not configured)
        let fileUrl = '';
        let fileSize: bigint | undefined;
        if (files.file && files.file[0]) {
            try {
                const fileResult = await uploadFile(
                    files.file[0].buffer,
                    files.file[0].originalname,
                    'digitalghar/products'
                );
                fileUrl = fileResult.publicId; // Store public ID for signed URLs
                fileSize = BigInt(fileResult.bytes);
            } catch (uploadError) {
                console.warn('⚠️ Cloudinary not configured, skipping file upload');
            }
        }

        // Calculate discount
        const discountPercent = data.originalPrice && data.originalPrice > data.price
            ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
            : undefined;

        const product = await prisma.product.create({
            data: {
                title: data.title,
                slug,
                shortDescription: data.shortDescription,
                longDescription: data.longDescription,
                categoryId: data.categoryId,
                price: data.price,
                originalPrice: data.originalPrice,
                discountPercent,
                productType: data.productType,
                ageGroup: data.ageGroup,
                licenseType: data.licenseType || 'PERSONAL',
                isFeatured: data.isFeatured || false,
                isActive: data.isActive ?? true,
                tags: data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : null,
                imageUrl,
                fileUrl,
                fileSize: fileSize ? Number(fileSize) : undefined,
            },
            include: { category: true },
        });

        // Log admin action
        await prisma.adminLog.create({
            data: {
                adminId: req.user!.id,
                action: 'created_product',
                entityType: 'product',
                entityId: product.id,
                details: JSON.stringify({ title: product.title }),
                ipAddress: req.ip || undefined,
            },
        });

        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('❌ Validation error:', error.issues);
            return res.status(400).json({
                error: 'Validation error',
                details: error.issues,
                message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            });
        }
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/products/:id', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
]), async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        const data = createProductSchema.partial().parse(JSON.parse(req.body.data || '{}'));
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updateData: any = { ...data };

        // Upload new image if provided
        if (files.image && files.image[0]) {
            const imageResult = await uploadImage(files.image[0].buffer, 'digitalghar/images');
            updateData.imageUrl = imageResult.url;
        }

        // Upload new file if provided
        if (files.file && files.file[0]) {
            const fileResult = await uploadFile(
                files.file[0].buffer,
                files.file[0].originalname,
                'digitalghar/products'
            );
            updateData.fileUrl = fileResult.publicId;
            updateData.fileSize = Number(fileResult.bytes);
        }

        // Recalculate discount if prices changed
        if (updateData.price || updateData.originalPrice) {
            const price = updateData.price || Number(existing.price);
            const origPrice = updateData.originalPrice || (existing.originalPrice ? Number(existing.originalPrice) : null);
            if (origPrice && origPrice > price) {
                updateData.discountPercent = Math.round(((origPrice - price) / origPrice) * 100);
            } else {
                updateData.discountPercent = null;
            }
        }

        const product = await prisma.product.update({
            where: { id: id },
            data: updateData,
            include: { category: true },
        });

        res.json({ message: 'Product updated', product });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await prisma.product.delete({ where: { id } });

        // Log admin action
        await prisma.adminLog.create({
            data: {
                adminId: req.user!.id,
                action: 'deleted_product',
                entityType: 'product',
                entityId: id,
                details: JSON.stringify({ title: product.title }),
                ipAddress: req.ip || undefined,
            },
        });

        res.json({ message: 'Product deleted' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ==================== CATEGORIES ====================

router.get('/categories', async (req: AuthRequest, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { displayOrder: 'asc' },
        });

        res.json({ categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

const categorySchema = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

router.post('/categories', async (req: AuthRequest, res: Response) => {
    try {
        const data = categorySchema.parse(req.body);

        const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const category = await prisma.category.create({
            data: {
                name: data.name,
                slug,
                description: data.description,
                icon: data.icon,
                displayOrder: data.displayOrder || 0,
                isActive: data.isActive ?? true,
            },
        });

        res.status(201).json({ message: 'Category created', category });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.put('/categories/:id', async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }
        const data = categorySchema.partial().parse(req.body);

        const category = await prisma.category.update({
            where: { id },
            data,
        });

        res.json({ message: 'Category updated', category });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }

        // Check if category has products
        const productCount = await prisma.product.count({ where: { categoryId: id } });
        if (productCount > 0) {
            return res.status(400).json({ error: 'Cannot delete category with products' });
        }

        await prisma.category.delete({ where: { id } });

        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// ==================== ORDERS ====================

router.get('/orders', async (req: AuthRequest, res: Response) => {
    try {
        const page = getQueryString(req.query.page) || '1';
        const limit = getQueryString(req.query.limit) || '20';
        const status = getQueryString(req.query.status);
        const search = getQueryString(req.query.search);

        const where: any = {};

        if (status) {
            where.paymentStatus = status;
        }

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { userEmail: { contains: search, mode: 'insensitive' } },
                { utrNumber: { contains: search, mode: 'insensitive' } },
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { name: true, email: true } },
                    items: { include: { product: { select: { title: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma.order.count({ where }),
        ]);

        res.json({
            orders,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Verify payment (mark as completed)
router.post('/orders/:id/verify', async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: { include: { product: true } } },
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.paymentStatus === 'VERIFIED') {
            return res.status(400).json({ error: 'Order already verified' });
        }

        // Update order status
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                paymentStatus: 'VERIFIED',
                orderStatus: 'COMPLETED',
                paidAt: new Date(),
            },
        });

        // Set download URLs and expiry for order items
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await Promise.all(
            order.items.map((item) =>
                prisma.orderItem.update({
                    where: { id: item.id },
                    data: {
                        downloadUrl: getSignedDownloadUrl(item.product.fileUrl, 7 * 24 * 3600),
                        expiresAt,
                    },
                })
            )
        );

        // Log admin action
        await prisma.adminLog.create({
            data: {
                adminId: req.user!.id,
                action: 'verified_payment',
                entityType: 'order',
                entityId: id,
                details: JSON.stringify({ orderNumber: order.orderNumber, amount: order.totalAmount }),
                ipAddress: req.ip || undefined,
            },
        });

        res.json({ message: 'Payment verified', order: updatedOrder });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

// Reject payment
router.post('/orders/:id/reject', async (req: AuthRequest, res: Response) => {
    try {
        const id = getQueryString(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'Invalid order ID' });
        }
        const { reason } = req.body;

        const order = await prisma.order.update({
            where: { id },
            data: {
                paymentStatus: 'FAILED',
                orderStatus: 'CANCELLED',
            },
        });

        // Log admin action
        await prisma.adminLog.create({
            data: {
                adminId: req.user!.id,
                action: 'rejected_payment',
                entityType: 'order',
                entityId: id,
                details: JSON.stringify({ orderNumber: order.orderNumber, reason }),
                ipAddress: req.ip || undefined,
            },
        });

        res.json({ message: 'Payment rejected', order });
    } catch (error) {
        console.error('Reject payment error:', error);
        res.status(500).json({ error: 'Failed to reject payment' });
    }
});

// ==================== USERS ====================

router.get('/users', async (req: AuthRequest, res: Response) => {
    try {
        const page = getQueryString(req.query.page) || '1';
        const limit = getQueryString(req.query.limit) || '20';
        const search = getQueryString(req.query.search);
        const role = getQueryString(req.query.role);

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (role) {
            where.role = role;
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true,
                    lastLogin: true,
                    _count: { select: { orders: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            users,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

export default router;

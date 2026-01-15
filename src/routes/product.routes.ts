import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { optionalAuth, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Helper to get string from query param
const getQueryString = (param: unknown): string | undefined => {
    if (typeof param === 'string') return param;
    if (Array.isArray(param) && typeof param[0] === 'string') return param[0];
    return undefined;
};

// Get all products (with filters)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const {
            category,
            type,
            minPrice,
            maxPrice,
            search,
            featured,
            sort = 'createdAt',
            order = 'desc',
            page = '1',
            limit = '12',
        } = req.query;

        const where: any = {
            isActive: true,
        };

        if (category) {
            where.category = { slug: category };
        }

        if (type) {
            where.productType = type;
        }

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice as string);
            if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { shortDescription: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (featured === 'true') {
            where.isFeatured = true;
        }

        const pageNum = parseInt(page as string) || 1;
        const limitNum = parseInt(limit as string) || 12;
        const skip = (pageNum - 1) * limitNum;

        const orderBy: any = {};
        orderBy[sort as string] = order;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: {
                        select: { id: true, name: true, slug: true },
                    },
                },
                orderBy,
                skip,
                take: limitNum,
            }),
            prisma.product.count({ where }),
        ]);

        // Increment view count (fire and forget)
        if (products.length > 0) {
            const ids = products.map(p => p.id);
            prisma.product.updateMany({
                where: { id: { in: ids } },
                data: { viewCount: { increment: 1 } },
            }).catch(() => { }); // Ignore errors
        }

        res.json({
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product by slug
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const slug = getQueryString(req.params.slug);
        if (!slug) {
            return res.status(400).json({ error: 'Invalid product slug' });
        }

        const product = await prisma.product.findUnique({
            where: { slug },
            include: {
                category: true,
                reviews: {
                    where: { isApproved: true },
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!product || !product.isActive) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Increment view count
        await prisma.product.update({
            where: { id: product.id },
            data: { viewCount: { increment: 1 } },
        });

        res.json({ product });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Get featured products
router.get('/featured/list', async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany({
            where: {
                isActive: true,
                isFeatured: true,
            },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
        });

        res.json({ products });
    } catch (error) {
        console.error('Get featured products error:', error);
        res.status(500).json({ error: 'Failed to fetch featured products' });
    }
});

export default router;

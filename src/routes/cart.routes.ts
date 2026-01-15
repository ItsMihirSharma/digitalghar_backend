import { Router, Response } from 'express';
import redis from '../utils/redis';
import prisma from '../utils/prisma';
import { optionalAuth, AuthRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const CART_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// Get cart key based on user or session
const getCartKey = (req: AuthRequest): string => {
    if (req.user) {
        return `cart:user:${req.user.id}`;
    }
    // Use session ID from cookie or header
    const sessionId = req.headers['x-session-id'] as string || req.cookies?.sessionId;
    return `cart:session:${sessionId || 'anonymous'}`;
};

// Get cart
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const cartKey = getCartKey(req);
        const cartData = await redis.get(cartKey);

        if (!cartData) {
            return res.json({ items: [], total: 0 });
        }

        const productIds = JSON.parse(cartData) as string[];

        if (productIds.length === 0) {
            return res.json({ items: [], total: 0 });
        }

        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                isActive: true,
            },
            select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                originalPrice: true,
                imageUrl: true,
                category: {
                    select: { name: true, slug: true },
                },
            },
        });

        const total = products.reduce(
            (sum, p) => sum + Number(p.price),
            0
        );

        res.json({
            items: products,
            total: parseFloat(total.toFixed(2)),
        });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

// Add to cart
router.post('/add', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID required' });
        }

        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, isActive: true },
        });

        if (!product || !product.isActive) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const cartKey = getCartKey(req);
        const cartData = await redis.get(cartKey);
        let productIds: string[] = cartData ? JSON.parse(cartData) : [];

        // Check if already in cart (digital products, no quantity)
        if (productIds.includes(productId)) {
            return res.status(400).json({ error: 'Product already in cart' });
        }

        productIds.push(productId);
        await redis.setex(cartKey, CART_EXPIRY, JSON.stringify(productIds));

        res.json({ message: 'Added to cart', count: productIds.length });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

// Remove from cart
router.delete('/remove/:productId', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { productId } = req.params;

        const cartKey = getCartKey(req);
        const cartData = await redis.get(cartKey);

        if (!cartData) {
            return res.status(404).json({ error: 'Cart is empty' });
        }

        let productIds: string[] = JSON.parse(cartData);
        productIds = productIds.filter(id => id !== productId);

        if (productIds.length === 0) {
            await redis.del(cartKey);
        } else {
            await redis.setex(cartKey, CART_EXPIRY, JSON.stringify(productIds));
        }

        res.json({ message: 'Removed from cart', count: productIds.length });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Failed to remove from cart' });
    }
});

// Clear cart
router.delete('/clear', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
        const cartKey = getCartKey(req);
        await redis.del(cartKey);

        res.json({ message: 'Cart cleared' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});

export default router;

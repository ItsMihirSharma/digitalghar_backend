"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const redis_1 = __importDefault(require("../utils/redis"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const CART_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
// Get cart key based on user or session
const getCartKey = (req) => {
    if (req.user) {
        return `cart:user:${req.user.id}`;
    }
    // Use session ID from cookie or header
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
    return `cart:session:${sessionId || 'anonymous'}`;
};
// Get cart
router.get('/', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const cartKey = getCartKey(req);
        const cartData = await redis_1.default.get(cartKey);
        if (!cartData) {
            return res.json({ items: [], total: 0 });
        }
        const productIds = JSON.parse(cartData);
        if (productIds.length === 0) {
            return res.json({ items: [], total: 0 });
        }
        const products = await prisma_1.default.product.findMany({
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
        const total = products.reduce((sum, p) => sum + Number(p.price), 0);
        res.json({
            items: products,
            total: parseFloat(total.toFixed(2)),
        });
    }
    catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});
// Add to cart
router.post('/add', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ error: 'Product ID required' });
        }
        // Check if product exists
        const product = await prisma_1.default.product.findUnique({
            where: { id: productId },
            select: { id: true, isActive: true },
        });
        if (!product || !product.isActive) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const cartKey = getCartKey(req);
        const cartData = await redis_1.default.get(cartKey);
        let productIds = cartData ? JSON.parse(cartData) : [];
        // Check if already in cart (digital products, no quantity)
        if (productIds.includes(productId)) {
            return res.status(400).json({ error: 'Product already in cart' });
        }
        productIds.push(productId);
        await redis_1.default.setex(cartKey, CART_EXPIRY, JSON.stringify(productIds));
        res.json({ message: 'Added to cart', count: productIds.length });
    }
    catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});
// Remove from cart
router.delete('/remove/:productId', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const { productId } = req.params;
        const cartKey = getCartKey(req);
        const cartData = await redis_1.default.get(cartKey);
        if (!cartData) {
            return res.status(404).json({ error: 'Cart is empty' });
        }
        let productIds = JSON.parse(cartData);
        productIds = productIds.filter(id => id !== productId);
        if (productIds.length === 0) {
            await redis_1.default.del(cartKey);
        }
        else {
            await redis_1.default.setex(cartKey, CART_EXPIRY, JSON.stringify(productIds));
        }
        res.json({ message: 'Removed from cart', count: productIds.length });
    }
    catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ error: 'Failed to remove from cart' });
    }
});
// Clear cart
router.delete('/clear', auth_middleware_1.optionalAuth, async (req, res) => {
    try {
        const cartKey = getCartKey(req);
        await redis_1.default.del(cartKey);
        res.json({ message: 'Cart cleared' });
    }
    catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});
exports.default = router;
//# sourceMappingURL=cart.routes.js.map
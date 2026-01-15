"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../utils/prisma"));
const router = (0, express_1.Router)();
// Helper to get string from query param
const getQueryString = (param) => {
    if (typeof param === 'string')
        return param;
    if (Array.isArray(param) && typeof param[0] === 'string')
        return param[0];
    return undefined;
};
// Get all categories
router.get('/', async (req, res) => {
    try {
        const { includeProducts } = req.query;
        const categories = await prisma_1.default.category.findMany({
            where: { isActive: true },
            include: includeProducts === 'true' ? {
                products: {
                    where: { isActive: true },
                    take: 4,
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: { products: true },
                },
            } : {
                _count: {
                    select: { products: true },
                },
            },
            orderBy: { displayOrder: 'asc' },
        });
        res.json({ categories });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
// Get category by slug
router.get('/:slug', async (req, res) => {
    try {
        const slug = getQueryString(req.params.slug);
        if (!slug) {
            return res.status(400).json({ error: 'Invalid category slug' });
        }
        const category = await prisma_1.default.category.findUnique({
            where: { slug },
            include: {
                _count: {
                    select: { products: true },
                },
            },
        });
        if (!category || !category.isActive) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ category });
    }
    catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});
exports.default = router;
//# sourceMappingURL=category.routes.js.map
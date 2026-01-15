import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@digitalghar.in' },
        update: {},
        create: {
            email: 'admin@digitalghar.in',
            passwordHash: adminPassword,
            name: 'Admin',
            role: 'ADMIN',
            isVerified: true,
        },
    });
    console.log('✅ Admin user created:', admin.email);

    // Create categories
    const categories = [
        { name: 'Kids Activities', slug: 'kids-activities', description: 'Fun activities for kids', icon: '🎨', displayOrder: 1 },
        { name: 'Educational PDFs', slug: 'educational-pdfs', description: 'Learning materials and worksheets', icon: '📚', displayOrder: 2 },
        { name: 'PLR Products', slug: 'plr-products', description: 'Private Label Rights products', icon: '📦', displayOrder: 3 },
        { name: 'Templates', slug: 'templates', description: 'Ready-to-use templates', icon: '📄', displayOrder: 4 },
        { name: 'Video Courses', slug: 'video-courses', description: 'Video-based learning', icon: '🎥', displayOrder: 5 },
        { name: 'Planners & Journals', slug: 'planners-journals', description: 'Printable planners and journals', icon: '📓', displayOrder: 6 },
    ];

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { slug: cat.slug },
            update: {},
            create: cat,
        });
    }
    console.log('✅ Categories created');

    // Create sample products
    const kidsCategory = await prisma.category.findUnique({ where: { slug: 'kids-activities' } });
    const pdfCategory = await prisma.category.findUnique({ where: { slug: 'educational-pdfs' } });
    const plrCategory = await prisma.category.findUnique({ where: { slug: 'plr-products' } });

    if (kidsCategory && pdfCategory && plrCategory) {
        const sampleProducts = [
            {
                title: 'Kids Coloring Book - Animals',
                slug: 'kids-coloring-book-animals',
                shortDescription: '50+ adorable animal coloring pages for kids aged 3-10',
                longDescription: 'This coloring book features over 50 beautifully illustrated animal pages. Perfect for keeping kids entertained while developing their creativity and motor skills. Includes lions, elephants, giraffes, and many more!',
                categoryId: kidsCategory.id,
                price: 149,
                originalPrice: 299,
                productType: 'PDF',
                ageGroup: '3-10 years',
                imageUrl: 'https://placehold.co/600x400/E8E8E8/171717?text=Coloring+Book',
                fileUrl: 'sample-file',
                isFeatured: true,
                licenseType: 'PERSONAL',
                tags: JSON.stringify(['coloring', 'kids', 'animals', 'printable']),
            },
            {
                title: 'Mathematics Worksheets - Grade 1-3',
                slug: 'math-worksheets-grade-1-3',
                shortDescription: '100 practice worksheets for elementary math',
                longDescription: 'Comprehensive math worksheet collection covering addition, subtraction, multiplication basics, and number recognition. Perfect for homeschooling and classroom use.',
                categoryId: pdfCategory.id,
                price: 199,
                originalPrice: 399,
                productType: 'PDF',
                ageGroup: '5-8 years',
                imageUrl: 'https://placehold.co/600x400/E8E8E8/171717?text=Math+Worksheets',
                fileUrl: 'sample-file',
                isFeatured: true,
                licenseType: 'PERSONAL',
                tags: JSON.stringify(['math', 'worksheets', 'education', 'printable']),
            },
            {
                title: 'Digital Planner 2026 - PLR License',
                slug: 'digital-planner-2026-plr',
                shortDescription: 'Complete digital planner with PLR rights',
                longDescription: 'Full year digital planner for 2026 with monthly, weekly, and daily spreads. Comes with PLR license - rebrand and sell as your own!',
                categoryId: plrCategory.id,
                price: 499,
                originalPrice: 999,
                productType: 'PLR',
                imageUrl: 'https://placehold.co/600x400/E8E8E8/171717?text=Digital+Planner',
                fileUrl: 'sample-file',
                isFeatured: true,
                licenseType: 'PLR',
                tags: JSON.stringify(['planner', 'plr', 'digital', '2026']),
            },
            {
                title: 'Hindi Alphabet Flashcards',
                slug: 'hindi-alphabet-flashcards',
                shortDescription: 'Printable Hindi varnamala flashcards with pictures',
                longDescription: 'Beautiful Hindi alphabet flashcards featuring all 52 letters with colorful illustrations. Perfect for teaching Hindi to young children.',
                categoryId: kidsCategory.id,
                price: 99,
                productType: 'PDF',
                ageGroup: '3-7 years',
                imageUrl: 'https://placehold.co/600x400/E8E8E8/171717?text=Hindi+Flashcards',
                fileUrl: 'sample-file',
                isFeatured: false,
                licenseType: 'PERSONAL',
                tags: JSON.stringify(['hindi', 'flashcards', 'alphabet', 'kids']),
            },
            {
                title: 'Science Experiments for Kids',
                slug: 'science-experiments-kids',
                shortDescription: '25 fun and safe science experiments you can do at home',
                longDescription: 'Step-by-step instructions for 25 exciting science experiments using household items. Each experiment includes safety tips and learning objectives.',
                categoryId: pdfCategory.id,
                price: 179,
                originalPrice: 299,
                productType: 'PDF',
                ageGroup: '6-12 years',
                imageUrl: 'https://placehold.co/600x400/E8E8E8/171717?text=Science+Experiments',
                fileUrl: 'sample-file',
                isFeatured: true,
                licenseType: 'PERSONAL',
                tags: JSON.stringify(['science', 'experiments', 'kids', 'education']),
            },
        ];

        for (const product of sampleProducts) {
            await prisma.product.upsert({
                where: { slug: product.slug },
                update: {},
                create: product,
            });
        }
        console.log('✅ Sample products created');
    }

    console.log('🎉 Database seeding complete!');
}

main()
    .catch((e) => {
        console.error('Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

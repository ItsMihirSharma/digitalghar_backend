import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
    {
        name: 'E-Books & Reading Material',
        slug: 'ebooks-reading',
        description: 'PDF Books, Study Notes, Novels, Self-Help & Spiritual Books',
        icon: '📘',
        displayOrder: 1,
        isActive: true,
    },
    {
        name: 'Online Courses & Learning',
        slug: 'online-courses',
        description: 'Video Courses, Skill Development, Language Learning & Certifications',
        icon: '🎓',
        displayOrder: 2,
        isActive: true,
    },
    {
        name: 'Templates & Ready-to-Use Files',
        slug: 'templates',
        description: 'Resume, Business Plans, PowerPoint, Excel & Notion Templates',
        icon: '🧩',
        displayOrder: 3,
        isActive: true,
    },
    {
        name: 'Design & Creative Assets',
        slug: 'design-assets',
        description: 'Logo Templates, Social Media Designs, Canva Templates & UI Kits',
        icon: '🎨',
        displayOrder: 4,
        isActive: true,
    },
    {
        name: 'Audio Products',
        slug: 'audio-products',
        description: 'Music Tracks, Sound Effects, Meditation Audio & Audiobooks',
        icon: '🎵',
        displayOrder: 5,
        isActive: true,
    },
    {
        name: 'Video & Visual Content',
        slug: 'video-content',
        description: 'Stock Videos, Motion Graphics, Animation & YouTube Templates',
        icon: '🎥',
        displayOrder: 6,
        isActive: true,
    },
    {
        name: 'Software & Digital Tools',
        slug: 'software-tools',
        description: 'Mobile Apps, Desktop Software, WordPress Themes & Plugins',
        icon: '💻',
        displayOrder: 7,
        isActive: true,
    },
    {
        name: 'Business & Marketing Resources',
        slug: 'business-marketing',
        description: 'Marketing Toolkits, Sales Funnels, Email Templates & Ad Creatives',
        icon: '📈',
        displayOrder: 8,
        isActive: true,
    },
    {
        name: 'Educational & Academic Resources',
        slug: 'educational-academic',
        description: 'Question Banks, Practice Tests, Worksheets & Teacher Resources',
        icon: '🧠',
        displayOrder: 9,
        isActive: true,
    },
    {
        name: 'Kids & Parenting',
        slug: 'kids-parenting',
        description: 'Learning PDFs, Activity Sheets, Coloring Books & Moral Stories',
        icon: '🧸',
        displayOrder: 10,
        isActive: true,
    },
    {
        name: 'Health, Fitness & Lifestyle',
        slug: 'health-fitness',
        description: 'Diet Plans, Workout Guides, Yoga Programs & Mental Health Journals',
        icon: '🌿',
        displayOrder: 11,
        isActive: true,
    },
    {
        name: 'Legal, Finance & Professional',
        slug: 'legal-finance',
        description: 'Legal Drafts, Agreement Templates, Financial Planners & Tax Guides',
        icon: '📜',
        displayOrder: 12,
        isActive: true,
    },
    {
        name: 'Bundles & Special Offers',
        slug: 'bundles-offers',
        description: 'Mega PDF Bundles, Course Bundles & Festival Special Packs',
        icon: '🎁',
        displayOrder: 13,
        isActive: true,
    },
    {
        name: 'PLR / MRR / Resell Rights',
        slug: 'plr-mrr',
        description: 'PLR E-Books, MRR Courses, Resell License & White Label Products',
        icon: '🔑',
        displayOrder: 14,
        isActive: true,
    },
    {
        name: 'Photography & Digital Art',
        slug: 'photography-art',
        description: 'Stock Photos, Digital Paintings, Wallpapers & AI-Generated Art',
        icon: '🖼️',
        displayOrder: 15,
        isActive: true,
    },
];

async function main() {
    console.log('🌱 Seeding categories...');

    // Delete existing categories (optional - comment out if you want to keep existing)
    // await prisma.category.deleteMany({});

    for (const category of categories) {
        const created = await prisma.category.upsert({
            where: { slug: category.slug },
            update: category,
            create: category,
        });
        console.log(`✅ Created/Updated: ${created.name}`);
    }

    console.log('✨ Categories seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding categories:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

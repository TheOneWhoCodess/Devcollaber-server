const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const users = [
    {
        name: "Alex Chen",
        email: "alex@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
        role: "frontend",
        bio: "Building beautiful UIs with React and TypeScript. Passionate about design systems and accessibility.",
        skills: ["React", "TypeScript", "TailwindCSS", "Next.js", "Figma"],
        lookingFor: ["backend", "fullstack"],
        projectIdea: "A design system builder that generates Tailwind components from Figma designs automatically.",
        projectType: "saas",
        commitment: "parttime",
        experience: 4,
        github: "https://github.com",
        location: "San Francisco, USA",
        isAvailable: true,
        eloScore: 1350,
    },
    {
        name: "Priya Sharma",
        email: "priya@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
        role: "backend",
        bio: "Node.js and Python engineer with 6 years building scalable APIs. Love distributed systems.",
        skills: ["Node.js", "Python", "PostgreSQL", "Docker", "AWS", "Redis"],
        lookingFor: ["frontend", "fullstack"],
        projectIdea: "Real-time collaborative code editor like CodeSandbox but for backend API testing.",
        projectType: "saas",
        commitment: "fulltime",
        experience: 6,
        github: "https://github.com",
        location: "Bangalore, India",
        isAvailable: true,
        eloScore: 1420,
    },
    {
        name: "Marcus Williams",
        email: "marcus@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcus",
        role: "fullstack",
        bio: "Full-stack dev who loves shipping fast. Built 3 SaaS products from 0 to revenue.",
        skills: ["React", "Node.js", "MongoDB", "TypeScript", "AWS", "GraphQL"],
        lookingFor: ["ml", "devops"],
        projectIdea: "AI-powered code review tool that learns from your team's coding style over time.",
        projectType: "startup",
        commitment: "fulltime",
        experience: 5,
        github: "https://github.com",
        location: "London, UK",
        isAvailable: true,
        eloScore: 1380,
    },
    {
        name: "Yuki Tanaka",
        email: "yuki@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=yuki",
        role: "ml",
        bio: "ML engineer focused on NLP and LLMs. Previously at DeepMind. Open to founding a startup.",
        skills: ["Python", "PyTorch", "TensorFlow", "Go", "PostgreSQL", "Docker"],
        lookingFor: ["frontend", "backend", "fullstack"],
        projectIdea: "Developer tool that uses LLMs to auto-generate test cases from code comments.",
        projectType: "opensource",
        commitment: "parttime",
        experience: 7,
        github: "https://github.com",
        location: "Tokyo, Japan",
        isAvailable: true,
        eloScore: 1500,
    },
    {
        name: "Sofia Martinez",
        email: "sofia@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sofia",
        role: "mobile",
        bio: "iOS and React Native developer. Built apps with 500k+ downloads. Love clean animations.",
        skills: ["React Native", "Swift", "TypeScript", "Firebase", "Kotlin"],
        lookingFor: ["backend", "ml"],
        projectIdea: "Habit tracking app with AI-powered insights that adapts to your lifestyle patterns.",
        projectType: "startup",
        commitment: "parttime",
        experience: 4,
        github: "https://github.com",
        location: "Madrid, Spain",
        isAvailable: true,
        eloScore: 1310,
    },
    {
        name: "James O'Brien",
        email: "james@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
        role: "devops",
        bio: "DevOps and platform engineer. Kubernetes, Terraform, and cloud-native everything.",
        skills: ["Kubernetes", "Docker", "AWS", "Terraform", "Go", "Python"],
        lookingFor: ["frontend", "backend", "fullstack"],
        projectIdea: "Self-hosted deployment platform that makes Kubernetes as simple as pushing to GitHub.",
        projectType: "opensource",
        commitment: "flexible",
        experience: 8,
        github: "https://github.com",
        location: "Dublin, Ireland",
        isAvailable: true,
        eloScore: 1450,
    },
    {
        name: "Anya Patel",
        email: "anya@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=anya",
        role: "frontend",
        bio: "React and Vue specialist. Obsessed with performance, animations, and pixel-perfect UIs.",
        skills: ["React", "Vue", "TypeScript", "TailwindCSS", "Three.js", "GraphQL"],
        lookingFor: ["backend", "devops"],
        projectIdea: "3D portfolio builder where developers can showcase projects in an interactive space.",
        projectType: "saas",
        commitment: "parttime",
        experience: 3,
        github: "https://github.com",
        location: "Mumbai, India",
        isAvailable: true,
        eloScore: 1290,
    },
    {
        name: "Liam Nguyen",
        email: "liam@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=liam",
        role: "backend",
        bio: "Rust and Go enthusiast. Building high-performance systems that scale to millions.",
        skills: ["Rust", "Go", "PostgreSQL", "Redis", "Kafka", "Docker"],
        lookingFor: ["frontend", "ml"],
        projectIdea: "Open source distributed task queue built in Rust with a beautiful web dashboard.",
        projectType: "opensource",
        commitment: "parttime",
        experience: 5,
        github: "https://github.com",
        location: "Ho Chi Minh City, Vietnam",
        isAvailable: true,
        eloScore: 1390,
    },
    {
        name: "Emma Johansson",
        email: "emma@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
        role: "fullstack",
        bio: "T-shaped developer with product instincts. I ship MVPs fast and iterate based on data.",
        skills: ["Next.js", "Node.js", "TypeScript", "MongoDB", "TailwindCSS", "AWS"],
        lookingFor: ["ml", "mobile"],
        projectIdea: "Micro-SaaS marketplace where developers can buy and sell small automation scripts.",
        projectType: "saas",
        commitment: "flexible",
        experience: 4,
        github: "https://github.com",
        location: "Stockholm, Sweden",
        isAvailable: true,
        eloScore: 1340,
    },
    {
        name: "Carlos Rivera",
        email: "carlos@seed.com",
        password: "password123",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carlos",
        role: "ml",
        bio: "Computer vision and ML engineer. PhD dropout. Building real products with AI, not demos.",
        skills: ["Python", "PyTorch", "OpenCV", "FastAPI", "PostgreSQL", "AWS"],
        lookingFor: ["frontend", "fullstack"],
        projectIdea: "AI tool that automatically generates UI components from hand-drawn wireframe photos.",
        projectType: "startup",
        commitment: "fulltime",
        experience: 6,
        github: "https://github.com",
        location: "Mexico City, Mexico",
        isAvailable: true,
        eloScore: 1460,
    },
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        // Remove existing seed users
        await User.deleteMany({ email: { $in: users.map(u => u.email) } });
        console.log('Cleared old seed users');

        // Hash passwords and insert
        const seeded = await Promise.all(
            users.map(async (u) => {
                const hashed = await bcrypt.hash(u.password, 10);
                return { ...u, password: hashed };
            })
        );

        await User.insertMany(seeded);
        console.log(`✅ Seeded ${users.length} users successfully`);

        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
};

seed();
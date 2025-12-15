/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    // Se você estiver usando API Routes (Pages Router) em vez de Server Actions:
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default nextConfig;
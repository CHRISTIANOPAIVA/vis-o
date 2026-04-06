/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['better-sqlite3', 'sharp'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
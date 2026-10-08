/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['sharp'],
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
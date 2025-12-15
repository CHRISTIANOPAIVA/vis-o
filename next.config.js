/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a custom build dir to avoid permission issues with the default .next folder
  distDir: ".next-output",
};

//module.exports = nextConfig;
module.exports = {
  output: 'export',
};
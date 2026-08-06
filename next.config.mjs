/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No next/image here on purpose: avatars come straight from GitHub and
  // LeetCode via plain <img>, so the image optimizer never runs and needs no
  // remote-host allowlist.
};

export default nextConfig;

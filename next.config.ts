import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @huggingface/transformers from being bundled server-side
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-web"],
  async redirects() {
    return [
      {
        source: "/docs/agentic-v2-draft",
        destination: "/docs/agentic-v2",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xzwjlkngxuxttvqbboea.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

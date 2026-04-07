import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent @huggingface/transformers from being bundled server-side
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-web"],
};

export default nextConfig;

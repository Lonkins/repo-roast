import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output keeps the Docker image lean for self-host
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
};

export default nextConfig;

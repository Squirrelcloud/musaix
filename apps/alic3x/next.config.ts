import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // This app lives in a monorepo with its own lockfile; don't let Turbopack pick the repo root.
  turbopack: { root: import.meta.dirname },
};

// Mounts the eve agent in ./agent at /eve/v1/* (same origin). On Vercel it
// deploys as its own service inside this project.
export default withEve(nextConfig);

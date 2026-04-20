import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "path";

// Load shared root .env before Next.js reads process.env
config({ path: path.resolve(__dirname, "../.env") });

const nextConfig: NextConfig = {};

export default nextConfig;

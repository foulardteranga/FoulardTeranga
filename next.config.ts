import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// next.config.ts s'exécute avant que Next.js ne charge automatiquement les
// fichiers .env pour le reste de l'app — on les charge nous-mêmes pour lire
// NEXT_PUBLIC_SUPABASE_URL ici.
loadEnvConfig(process.cwd());

const supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        port: "",
        pathname: "/storage/v1/object/public/storefront-images/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;

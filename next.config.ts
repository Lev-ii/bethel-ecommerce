import type { NextConfig } from "next";

/**
 * Autorise next/image a optimiser les photos servies par Supabase Storage.
 *
 * Sans cette declaration, toute image dont l'URL sort du domaine du site
 * provoque une erreur. Le motif est construit depuis SUPABASE_URL, pour ne
 * pas ouvrir plus large que necessaire.
 */
const supabaseHost = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;

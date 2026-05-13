import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/settings",
        permanent: true,
      },
      {
        source: "/admin/users",
        destination: "/settings/users",
        permanent: true,
      },
      {
        source: "/admin/organizations",
        destination: "/settings/organization",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

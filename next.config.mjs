/** @type {import('next').NextConfig} */
const nextConfig = {
  // The old "Balcão" page was removed; its vale check now lives at /verificar.
  async redirects() {
    return [
      { source: "/balcao", destination: "/verificar", permanent: false },
      { source: "/balcao/verificar", destination: "/verificar", permanent: false },
      // Definições moved from /settings/birthday when the welcome SMS was added.
      { source: "/settings/birthday", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;

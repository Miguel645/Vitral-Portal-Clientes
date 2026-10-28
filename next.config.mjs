/** @type {import('next').NextConfig} */
const nextConfig = {
  // The old "Balcão" page was removed; its vale check now lives at /verificar.
  async redirects() {
    return [
      { source: "/balcao", destination: "/verificar", permanent: false },
      { source: "/balcao/verificar", destination: "/verificar", permanent: false },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg usa requires dinámicos/nativos: que Next lo cargue en runtime, no lo empaquete.
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },
  // CORS para imágenes estáticas: el renderer CanvasKit de Flutter web
  // necesita el header para poder pintar imágenes de otro origen (8090 -> 3005).
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;

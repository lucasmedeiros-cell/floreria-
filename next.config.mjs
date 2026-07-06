/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pg y Baileys usan requires dinámicos/nativos (crypto, WebSocket): que Next
  // los cargue en runtime, no los empaquete con webpack (lo rompería).
  experimental: {
    serverComponentsExternalPackages: [
      "pg",
      "@whiskeysockets/baileys",
      "pino",
      "qrcode",
    ],
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

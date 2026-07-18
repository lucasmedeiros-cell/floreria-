/** @type {import('next').NextConfig} */
const nextConfig = {
  // Directorio de build. Por defecto `.next`. Se puede aislar con NEXT_DIST para
  // correr DOS `next dev` en la misma carpeta sin que se pisen el build (p. ej.
  // el CRM web en :3000 y el backend de la app móvil en :3005). Sin esto, ambos
  // escriben en `.next` y se corrompen (CSS 404, ChunkLoadError).
  distDir: process.env.NEXT_DIST || ".next",
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

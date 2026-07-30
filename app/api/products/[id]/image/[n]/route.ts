import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handler, notFound } from "@/lib/api";
import { queryOne } from "@/lib/db";
import { productPhotos } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/products/<sku>/image/<n> — la foto `n` de un producto (pública).
 *
 * Las fotos se guardan como data URI dentro de la fila del producto (ver
 * app/api/uploads). Servirlas por esta ruta es lo que permite que la tienda y
 * la landing manden un enlace de 40 bytes en el HTML en vez de la imagen
 * entera, y que el navegador las guarde en su caché entre visitas.
 *
 * Una foto que NO es data URI (ruta en /public, URL de otro sitio) se responde
 * con una redirección: sigue funcionando sin caso especial en quien la pinta.
 */
export const GET = handler(
  async (req: NextRequest, { params }: { params: { id: string; n: string } }) => {
    const row = await queryOne<{ image: string | null; images: string[] | null }>(
      `SELECT image, images FROM products WHERE id = $1`,
      [params.id]
    );
    if (!row) return notFound("No existe ese producto.");

    const foto = productPhotos({ image: row.image ?? "", images: row.images ?? [] })[
      Number(params.n)
    ];
    if (!foto) return notFound("Ese producto no tiene esa foto.");

    if (!foto.startsWith("data:")) {
      return NextResponse.redirect(new URL(foto, req.url));
    }

    const coma = foto.indexOf(",");
    const mime = foto.slice(5, foto.indexOf(";")) || "image/jpeg";
    const bytes = Buffer.from(foto.slice(coma + 1), "base64");
    // ETag del contenido: si el negocio cambia la foto, el navegador se entera
    // en la siguiente revalidación (barata) en vez de quedarse con la vieja.
    const etag = `"${crypto.createHash("sha1").update(bytes).digest("base64url")}"`;

    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.length),
        ETag: etag,
        // Corta: la foto de un producto se puede cambiar desde el CRM y no
        // queremos que un cliente siga viendo la anterior durante días.
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  }
);

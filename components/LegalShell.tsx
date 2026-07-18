import Link from "next/link";
import Image from "next/image";
import { EASYPOS } from "@/lib/easypos";
import { LEGAL } from "@/lib/legal";

/**
 * Marco de las páginas legales (/privacidad, /eliminar-cuenta).
 *
 * Van con la marca de **easy pos**, no con la del negocio: quien publica la app
 * en Google Play y en App Store es easy pos, y es easy pos quien responde por el
 * tratamiento de los datos. Por eso tampoco dependen de la config del negocio —
 * las tiendas tienen que poder abrirlas sin iniciar sesión y sin que importe qué
 * comercio esté cargado.
 */
export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg">
      <header className="bg-black">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <Image
            src={EASYPOS.logo}
            alt=""
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <p className="font-sans text-lg font-semibold leading-none text-white">
              easy <span style={{ color: EASYPOS.yellow }}>pos</span>
            </p>
            <p
              className="mt-1 font-sans text-[10px] font-semibold tracking-[0.2em]"
              style={{ color: EASYPOS.yellow }}
            >
              {EASYPOS.tagline}
            </p>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-4xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 font-sans text-sm text-ink2">{intro}</p>
        <p className="mt-1 font-sans text-xs text-faint">
          Última actualización: {LEGAL.actualizado} · {LEGAL.empresa}
        </p>

        {/* Tipografía del cuerpo legal por selectores de hijo: mantiene el estilo
            acá y deja las páginas como puro contenido, sin clases repetidas. */}
        <div
          className="mt-10 font-sans text-[15px] leading-relaxed text-ink2
            [&_a]:text-ink [&_a]:underline
            [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink
            [&_h2:first-child]:mt-0
            [&_li]:mb-1.5
            [&_p]:mb-4
            [&_strong]:font-semibold [&_strong]:text-ink
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {children}
        </div>

        <footer className="mt-14 border-t border-line pt-6 font-sans text-xs text-faint">
          <Link href="/privacidad" className="underline hover:text-ink2">
            Política de privacidad
          </Link>
          {" · "}
          <Link href="/eliminar-cuenta" className="underline hover:text-ink2">
            Eliminar mi cuenta y mis datos
          </Link>
        </footer>
      </article>
    </main>
  );
}

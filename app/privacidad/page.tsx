import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad · easy pos",
  description:
    "Qué datos trata la app easy pos CRM, para qué, con quién se comparten y cómo se eliminan.",
};

/**
 * URL que se pega en la ficha de Google Play y de App Store. Las dos tiendas la
 * exigen y la revisan: tiene que abrir sin login y coincidir con lo declarado en
 * el formulario de Seguridad de los datos (Play) y en la App Privacy (Apple).
 *
 * Si cambia lo que la app hace con los datos, se cambia ESTE texto y los dos
 * formularios. Que no coincidan es motivo de rechazo.
 */
export default function PrivacidadPage() {
  return (
    <LegalShell
      title="Política de privacidad"
      intro="Aplica a la aplicación móvil easy pos CRM (Android y iOS) y al panel web de easy pos."
    >
      <h2>Qué es easy pos</h2>
      <p>
        easy pos es un sistema de punto de venta y gestión que usan comercios
        (florerías, ferreterías, minimarkets, farmacias y otros rubros) para
        administrar sus pedidos, clientes, productos y entregas. La app móvil es
        la herramienta de trabajo de los <strong>empleados</strong> de esos
        comercios: no es una app para consumidores finales y no se puede crear
        una cuenta desde ella.
      </p>
      <p>
        Cada comercio es el responsable de los datos de sus propios clientes.{" "}
        {LEGAL.empresa} provee el software y la infraestructura, y trata esos
        datos únicamente por encargo del comercio y para que el servicio
        funcione.
      </p>

      <h2>Qué datos tratamos</h2>
      <p>
        <strong>Del empleado que usa la app.</strong> Nombre, correo, rol dentro
        del comercio y una credencial de sesión. Sirven para autenticarlo y para
        mostrarle solo lo que su rol le permite ver.
      </p>
      <p>
        <strong>Del comercio.</strong> Los datos que el empleado carga o
        consulta en su trabajo: clientes (nombre, teléfono, dirección de
        entrega), pedidos, productos, precios y stock.
      </p>
      <p>
        <strong>Del dispositivo.</strong> Plataforma, modelo, versión del sistema
        operativo, versión de la app y dirección IP. Con esto el comercio ve qué
        dispositivos tiene vinculados a su cuenta y puede revocar el acceso de
        uno perdido o robado.
      </p>

      <h2>La cámara</h2>
      <p>
        La app pide permiso de cámara con un solo fin:{" "}
        <strong>leer el código de barras de un producto</strong> para darlo de
        alta o registrar su ingreso, en lugar de tipearlo a mano. El
        reconocimiento ocurre <strong>dentro del dispositivo</strong>: lo único
        que sale de la cámara es el número del código leído. No se toman, ni se
        guardan, ni se transmiten fotos o video. El permiso es opcional: si se
        deniega, el código se puede escribir a mano y el resto de la app funciona
        igual.
      </p>

      <h2>Con quién se comparten</h2>
      <p>
        <strong>Con nadie.</strong> La app no incluye publicidad, ni analítica de
        terceros, ni SDK de redes sociales, ni rastreo entre aplicaciones. No
        vendemos datos personales. Los datos viajan únicamente entre la app y el
        servidor del comercio, siempre cifrados con HTTPS.
      </p>
      <p>
        Solo los revelaríamos si nos lo exigiera una autoridad competente por una
        orden válida.
      </p>

      <h2>Cuánto tiempo se conservan</h2>
      <p>
        Mientras el comercio mantenga su cuenta activa, porque son su registro
        comercial. Al darse de baja, sus datos se eliminan dentro de los 90 días,
        salvo lo que haya que conservar por obligación contable o fiscal.
      </p>

      <h2>Cómo se eliminan</h2>
      <p>
        Un empleado puede pedir la eliminación de su cuenta y de sus datos
        personales en cualquier momento, desde{" "}
        <a href="/eliminar-cuenta">esta página</a> o escribiendo a{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Los datos de los
        clientes del comercio los elimina el propio comercio desde el panel, ya
        que es el responsable de ellos.
      </p>

      <h2>Seguridad</h2>
      <p>
        Todo el tráfico va por HTTPS; la app rechaza conexiones sin cifrar. Las
        contraseñas se guardan con hash, nunca en texto plano. Cada comercio vive
        en una base de datos separada, de modo que un comercio no puede alcanzar
        los datos de otro.
      </p>

      <h2>Menores</h2>
      <p>
        easy pos es una herramienta de trabajo y no está dirigida a menores de
        edad. No recopilamos datos de menores a sabiendas.
      </p>

      <h2>Contacto</h2>
      <p>
        Por cualquier consulta sobre esta política o sobre tus datos, escribinos
        a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Esta política se
        rige por la legislación de {LEGAL.jurisdiccion}.
      </p>
    </LegalShell>
  );
}

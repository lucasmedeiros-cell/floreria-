import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Eliminar mi cuenta y mis datos · easy pos",
  description:
    "Cómo pedir la eliminación de una cuenta de easy pos y de los datos asociados.",
};

/**
 * Google Play exige una URL pública de eliminación de datos para toda app que
 * maneje cuentas, y la revisa: tiene que abrir sin iniciar sesión, decir QUÉ se
 * borra, QUÉ se conserva y CUÁNTO tarda. Se pega en Play Console → Seguridad de
 * los datos → Eliminación de cuenta.
 */
export default function EliminarCuentaPage() {
  return (
    <LegalShell
      title="Eliminar mi cuenta y mis datos"
      intro="Cómo pedir que borremos tu cuenta de easy pos y los datos personales asociados a ella."
    >
      <h2>Cómo pedirlo</h2>
      <p>
        Escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> desde el
        correo con el que iniciás sesión en easy pos, con el asunto{" "}
        <strong>&laquo;Eliminar mi cuenta&raquo;</strong>. Necesitamos que sea
        desde ese correo para confirmar que la cuenta es tuya: es la única forma
        que tenemos de no borrarle los datos a la persona equivocada.
      </p>
      <p>
        Si sos el dueño del comercio y querés dar de baja la cuenta{" "}
        <strong>completa</strong> del negocio (con todos sus empleados, clientes,
        pedidos y productos), aclaralo en el mensaje.
      </p>

      <h2>Qué se elimina</h2>
      <ul>
        <li>Tu nombre, tu correo y tu rol dentro del comercio.</li>
        <li>Tu contraseña y todas tus sesiones activas.</li>
        <li>
          El registro de los dispositivos que vinculaste (modelo, sistema
          operativo, versión de la app, última IP).
        </li>
      </ul>
      <p>
        Si pedís la baja del comercio entero, se elimina además toda su base:
        clientes, pedidos, productos y configuración.
      </p>

      <h2>Qué se conserva, y por qué</h2>
      <p>
        Los <strong>pedidos ya facturados</strong> se conservan por el plazo que
        exige la normativa contable y fiscal, porque son el registro comercial
        del negocio y no podemos borrarlos legalmente. Se desvinculan de tu
        persona: quedan en el historial sin tu nombre ni tu correo.
      </p>
      <p>
        Los <strong>datos de los clientes del comercio</strong> le pertenecen al
        comercio, no a vos. Si sos empleado, eliminar tu cuenta no borra la
        cartera de clientes de tu empleador — eso lo decide el dueño del negocio.
      </p>

      <h2>Cuánto tarda</h2>
      <p>
        Confirmamos el pedido dentro de las <strong>72 horas</strong> y
        completamos la eliminación dentro de los <strong>30 días</strong>.
        También se borra de las copias de respaldo dentro de los{" "}
        <strong>90 días</strong>, que es lo que dura el ciclo de retención de los
        backups.
      </p>

      <h2>Contacto</h2>
      <p>
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> · {LEGAL.empresa}.
        Podés leer también nuestra{" "}
        <a href="/privacidad">política de privacidad</a>.
      </p>
    </LegalShell>
  );
}

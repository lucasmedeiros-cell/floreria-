# Instalar el servidor easy pos en la PC del cliente (Windows)

El sistema tiene tres piezas y **todas viven en el local del cliente** (no
depende de internet ni de nuestra red):

| Pieza | Dónde corre | Qué es |
|---|---|---|
| **Servidor easy pos** | PC del negocio, puerto 3010 | Node + Next + **PostgreSQL con TODOS los datos** |
| Programa de PC | La misma PC (u otra del local) | La pantalla del POS; se conecta a `http://localhost:3010` |
| App del celular | Teléfonos del local | Se conecta por WiFi; **encuentra el servidor sola** escaneando la red |

El error "No se pudo conectar" del login significa que en esa PC está instalado
solo el programa (la pantalla) pero **falta el servidor**. Esta guía lo instala.

## Camino recomendado: instalador TODO-EN-UNO (sin internet en el cliente)

Un solo `.exe` que instala el programa de PC **y** deja el servidor andando.
Nació de los problemas reales de la primera instalación en campo (2026-07-20):
PC con un PostgreSQL 9.6 viejo de otro programa, descargas de EDB cortadas con
403, bloqueo de ExecutionPolicy y PowerShell sin admin. El todo-en-uno los
evita de raíz:

- **Nada se descarga en el cliente**: PostgreSQL 16, Node portable y todas las
  dependencias van dentro del `.exe`.
- **Corre elevado solo** (NSIS `perMachine`) y lanza la configuración con
  `-ExecutionPolicy Bypass`: sin pasos manuales de PowerShell.
- **Respeta un PostgreSQL viejo** si existe: instala el 16 al lado, en el
  puerto libre (5433), y ajusta `.env.local` solo.
- **Sin preguntas** en el camino normal (aguanta cortes de AnyDesk); todo queda
  en `C:\easypos-servidor\instalacion.log`.

Generarlo (los binarios a embeber se descargan una sola vez, ver cabecera del
script):

```bash
bash scripts/empaquetar-instalador-todo-en-uno.sh
# → desktop/dist/AutoPiezasCoquito-Setup-<versión>.exe
```

En el cliente: ejecutar el `.exe`, siguiente-siguiente, esperar el cartel verde
LISTO en la consola que se abre al final. Nada más. Si algo falla, el mismo
`.exe` se puede volver a ejecutar (todo es re-entrante), o correr
`powershell -ExecutionPolicy Bypass -File C:\easypos-servidor\configurar-servidor.ps1`.

## Alternativa liviana: paquete ZIP (necesita internet en el cliente)

```bash
bash scripts/empaquetar-servidor-coquito.sh
```

Deja `dist-coquito/easypos-servidor-coquito-<fecha>.zip` (unos MB: build de
producción + esquema de base + scripts de instalación; sin `node_modules`).
Llevarlo en USB o mandarlo por Drive/WhatsApp a la PC del cliente.

## En la PC del cliente (una sola vez, con internet)

1. Descomprimir el ZIP en `C:\easypos-servidor`.
2. Abrir **PowerShell como Administrador** y correr:

   ```powershell
   cd C:\easypos-servidor
   Set-ExecutionPolicy -Scope Process Bypass -Force
   .\instalar.ps1
   ```

3. El script hace todo y avisa si le falta algo:
   - Instala **Node.js LTS** y **PostgreSQL 16** (con `winget`; si la PC no
     tiene winget, pide instalarlos a mano desde nodejs.org / postgresql.org y
     volver a correr — el script es re-ejecutable sin romper nada).
   - Crea la base `bo_epos_coquito` con el esquema completo, la config del
     negocio y el usuario `admin@coquito.local` / `Coquito-Wd3sV5A3`.
   - Baja las dependencias (`npm ci`, la única parte que necesita internet).
   - Abre el puerto **3010** en el Firewall de Windows.
   - Deja la tarea programada **easypos-servidor**: el servidor arranca solo
     cada vez que se prende la PC, sin iniciar sesión ni abrir nada.
   - Arranca y verifica `http://localhost:3010/api/health`.

4. Al final imprime "LISTO" con la IP de la PC para los celulares.

## Después de instalar

- **Programa de PC**: en "Servidor easy pos" dejar `http://localhost:3010`,
  botón **Probar** → "Conectado", e ingresar con las credenciales de arriba.
- **Celulares**: conectarlos a la **misma WiFi** del negocio y abrir la app;
  si el servidor guardado no responde, la app escanea la red y lo encuentra
  sola (también se puede escribir `http://<ip-pc>:3010` a mano en
  "Cambiar servidor").
- Recomendado: en el router del cliente, fijarle la IP a la PC (reserva DHCP).
  No es obligatorio —la app se adapta si cambia— pero evita esperas de escaneo.

## Exportar / respaldar los datos del cliente

La instalación deja en el escritorio el acceso directo **"Exportar datos easy
pos"** (también está `C:\easypos-servidor\Exportar datos easy pos.bat`). Al
ejecutarlo crea en `Documentos\easypos-exportaciones\<fecha>` una exportación
en tres formatos, según para qué se necesite:

| Archivo | Para qué sirve |
|---|---|
| `respaldo-completo.backup` | Restaurar el sistema tal cual (`pg_restore -U easypos -d bo_epos_coquito --clean respaldo-completo.backup`). **El respaldo de verdad.** |
| `respaldo-completo.sql` | Migrar los datos a cualquier PostgreSQL (otro servidor, la nube). |
| `productos / ventas / ventas-detalle / gastos / cortes-caja / clientes / usuarios .csv` | Se abren directo en Excel (UTF-8 con BOM, separados por `;`). |

Solo lee la base (no interrumpe la operación) y abre la carpeta al terminar.
Recomendarle al cliente hacerlo seguido y copiar la carpeta a un pendrive.

## Problemas típicos

| Síntoma | Causa / solución |
|---|---|
| `instalar.ps1` falla en npm ci | Sin internet en ese momento; reintentar. Alternativa: copiar `node_modules` desde otra instalación al paquete. |
| El programa conecta pero el celular no | Celular en otra red (datos móviles / otra WiFi). Ponerlo en la WiFi del local. Ver también aislamiento de clientes ("AP isolation") en el router. |
| No arranca al prender la PC | Ver `C:\easypos-servidor\servidor.log`; la tarea es `easypos-servidor` en el Programador de tareas. |
| Cambió la clave del admin | Resetear en la base: `UPDATE employees SET pass_hash = crypt('NuevaClave', gen_salt('bf',10)) WHERE email='admin@coquito.local';` |

## Qué papel juega internet

Ninguno para operar: ventas, caja, stock y reportes son 100% locales. Internet
solo se usa al instalar, y opcionalmente para el botón de reporte de errores
(tickets) y la búsqueda de productos por código de barras.

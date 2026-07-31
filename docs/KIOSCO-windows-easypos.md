# Modo kiosco de easy pos en Windows

Deja una PC dedicada al CRM: al encenderla se abre sola, a pantalla completa,
en el CRM del negocio — sin barra de direcciones, sin pestañas y sin menús. Es
para el equipo del mostrador, que no tiene que hacer otra cosa que vender.

**CRM de Auto Piezas Coquito** (el que queda configurado por defecto):

```
https://easypos.easypaybo.com/n/auto_piezas_coquito/admin
```

Para otro negocio es la misma dirección cambiando el slug:
`https://easypos.easypaybo.com/n/<negocio>/admin`.

---

## 1. Instalación (5 minutos, sin ser administrador)

En la PC del mostrador, **con el usuario de Windows que va a atender**:

1. Copiar la carpeta `scripts/kiosco-windows` a la PC (por ejemplo a
   `C:\easypos-kiosco`).
2. Doble clic en **`Instalar modo kiosco.bat`**.
3. Cuando diga `LISTO`, probarlo con el acceso que dejó en
   `%LOCALAPPDATA%\easypos-kiosco`.
4. La primera vez, **iniciar sesión en el CRM una sola vez**. Queda guardada:
   los siguientes arranques entran directo.

Desde ahí, cada vez que se inicie sesión en Windows el CRM se abre solo.

### Si preferís hacerlo a mano

```powershell
cd C:\easypos-kiosco
powershell -ExecutionPolicy Bypass -File .\configurar-kiosco.ps1
```

Opciones:

| Para qué | Cómo |
|---|---|
| Otro negocio | `.\configurar-kiosco.ps1 -Url "https://easypos.easypaybo.com/n/otro/admin"` |
| Servidor local (el de la propia PC) | `.\configurar-kiosco.ps1 -Url "http://localhost:3010/admin"` |
| Forzar Chrome (o Edge) | `.\configurar-kiosco.ps1 -Navegador chrome` |
| Ticket sin el cuadro de "Imprimir" | `.\configurar-kiosco.ps1 -SinDialogoDeImpresion` |
| Desarmarlo | `.\configurar-kiosco.ps1 -Quitar` |

---

## 2. Qué hace por dentro

- Usa **Edge** (viene con Windows) o **Chrome**, el que esté instalado.
- Abre el navegador con `--kiosk`: pantalla completa real, sin barras.
- Le da un **perfil propio** (`%LOCALAPPDATA%\easypos-kiosco\perfil`): la sesión
  del CRM sobrevive a los reinicios y no se mezcla con la navegación personal de
  nadie.
- Si se corta la luz, al volver **no** pregunta "restaurar páginas": entra
  derecho al CRM (`--disable-session-crashed-bubble`, `--hide-crash-restore-bubble`).
- Deja un acceso directo en la carpeta de Inicio del usuario, así arranca solo.

**Salir del kiosco:** `Alt+F4`. (O `Ctrl+Alt+Supr` → Administrador de tareas.)

---

## 3. Recomendado para que quede redondo

Nada de esto es obligatorio, pero es lo que hace que la PC se comporte como una
terminal y no como una computadora de escritorio.

**Que no se apague la pantalla ni se suspenda** (PowerShell como administrador):

```powershell
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
```

**Que entre a Windows sin pedir contraseña** — solo si la PC está en un
mostrador a la vista, porque cualquiera que la encienda queda dentro del CRM:

```
Win+R  →  netplwiz  →  destildar "Los usuarios deben escribir su nombre y
contraseña"  →  Aplicar  →  escribir la contraseña de esa cuenta.
```

**Impresión del ticket sin diálogo:** correr el script con
`-SinDialogoDeImpresion` y dejar la impresora del mostrador como
**impresora predeterminada** de Windows. El comprobante sale directo.

---

## 4. Kiosco "de verdad" (Windows Pro/Enterprise)

Lo de arriba es un kiosco práctico: el usuario puede salir con `Alt+F4` y llegar
al escritorio. Si hace falta que **no** pueda salir, Windows Pro/Enterprise trae
**Acceso asignado** (*Assigned Access*), que bloquea la sesión entera en un solo
navegador:

```
Configuración → Cuentas → Otros usuarios → Configurar un quiosco
  → elegir Microsoft Edge
  → "Como quiosco digital" (pantalla completa)
  → URL:  https://easypos.easypaybo.com/n/auto_piezas_coquito/admin
```

Se le crea una cuenta local propia y esa sesión no tiene escritorio ni
Explorador. Para administrar la PC se entra con otra cuenta.

Diferencias:

| | Este script | Acceso asignado |
|---|---|---|
| Edición de Windows | cualquiera (Home incluida) | Pro / Enterprise / Education |
| Necesita administrador | no | sí |
| Se puede salir | sí, `Alt+F4` | no |
| Guarda la sesión del CRM | sí | sí |

---

## 5. Si algo no anda

**Pide iniciar sesión cada vez.** El perfil se está borrando: revisar que nadie
limpie `%LOCALAPPDATA%\easypos-kiosco\perfil`, y que en Edge el kiosco no esté
en modo "navegación pública" (el script ya fuerza
`--edge-kiosk-type=fullscreen`, que es el correcto).

**Se abre en blanco o dice que no hay internet.** El CRM vive en el servidor de
easy pos: sin internet no abre. Si el negocio tiene el servidor local instalado
en esa misma PC, configurar el kiosco contra
`http://localhost:3010/admin`, que funciona sin internet.

**No arranca solo.** Comprobar que el acceso directo esté en la carpeta de
Inicio: `Win+R` → `shell:startup` → tiene que estar
`Iniciar kiosco easy pos.lnk`.

**Quiero volver todo atrás.** `.\configurar-kiosco.ps1 -Quitar` y listo (la
carpeta del perfil queda por si hace falta; se borra a mano).

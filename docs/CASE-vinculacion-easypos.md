# Vinculación de dispositivos easy pos — lado de Case

Qué tiene que hacer **Case** (`case.easypaybo.com`) para generar el QR con el que
el equipo de ventas vincula un teléfono a un negocio de easy pos.

La app easy pos ya está lista para consumir este QR; Case solo tiene que
**registrar el dispositivo en la central** y **mostrar el QR con el formato de
abajo**. No hace falta llamar a ningún endpoint de easy pos: Case escribe directo
en su propia base central.

---

## 1. Registrar el dispositivo (base central `bo_case_central`)

Insertá una fila en la tabla **`dispositivo`** ligando un **token** al negocio:

```sql
INSERT INTO dispositivo (id, negocio_id, token, habilitado, fecha_alta, label)
VALUES (
  gen_random_uuid()::text,                 -- id: cualquier texto único
  $negocio_id,                             -- negocio.id del negocio easy pos
  encode(gen_random_bytes(24), 'hex'),     -- token: 48 hex (¡guardalo para el QR!)
  true,                                    -- habilitado: sin esto la app NO conecta
  now(),
  $etiqueta                                -- opcional: "Caja 1", "Tablet ventas", etc.
);
```

En Node (si Case lo hace en la app, no en SQL):

```js
const token = crypto.randomBytes(24).toString("hex"); // 48 hex
// INSERT ... (id, negocio_id, token, habilitado=true, fecha_alta=now(), label)
```

Requisitos que ya se cumplen y hay que mantener:
- El **token** son **48 caracteres hex en minúscula** (`crypto.randomBytes(24)`).
  La app valida `^[a-f0-9]{32,}$`.
- `habilitado = true`. Si está en `false`, el negocio **no** resuelve (así se
  revoca un equipo: `UPDATE dispositivo SET habilitado=false WHERE token=$t`).
- El **negocio** tiene que ser `producto = 'easypos'` (ya lo es).
- El token es **de un solo negocio**: un token → un `negocio_id`.

> La app easy pos resuelve el negocio con esta consulta (no cambiar el contrato):
> ```sql
> SELECT n.* FROM dispositivo d JOIN negocio n ON n.id = d.negocio_id
>  WHERE d.token = $1 AND n.producto = 'easypos' AND d.habilitado;
> ```
> Los cambios de `habilitado` tardan hasta **30 s** en aplicar (hay caché).

---

## 2. Qué tiene que codificar el QR

El QR lleva un **JSON** con el token y el **servidor de easy pos** (no el de Case):

```json
{"token":"<los 48 hex de arriba>","server":"https://easypos.easypaybo.com"}
```

- `server` = la **URL del backend de easy pos** (donde vive la app/API), **no**
  `case.easypaybo.com`. En producción es `https://easypos.easypaybo.com`.
  (Para pruebas, el que se esté usando; ver sección 4.)
- Sin barra final, con `https://`.

Alternativa equivalente (si a Case le resulta más cómodo un texto/URL):

```
https://easypos.easypaybo.com/pair?token=<48 hex>
```

La app acepta las dos: del JSON toma `token`+`server`; de la URL toma el `token`
del query y el `server` del origen. Recomendado el **JSON** (explícito).

Generá la imagen del QR con cualquier librería (Case ya usa `qrcode`): el
contenido es ese string, nivel de corrección M, ~256–320 px.

---

## 3. Qué hace la app al escanear (para que sepas que está bien)

1. Adopta `server` → todas sus llamadas van a `https://easypos.easypaybo.com`.
2. Guarda el `token` y lo manda como header `X-Device-Token` en cada request.
3. Llama a `GET /api/business`; el backend resuelve el negocio por el token
   (consulta de la sección 1) y responde su config → **queda vinculado**.
4. En cada request, el backend actualiza `last_seen`, `plataforma`, `modelo`,
   `app_version`, `ultimo_ip` del dispositivo (podés mostrar eso en Case).

No hay código de 6 dígitos ni nada que escribir: solo escanear.

---

## 4. Servidor a usar en el QR

- **Producción:** `https://easypos.easypaybo.com` (cuando el DNS + deploy estén).
- **Mientras tanto (pruebas):** el backend está expuesto por un túnel temporal;
  usá esa URL como `server` en el QR de prueba. (La coordinamos aparte porque
  cambia si se reinicia.)

El **token no cambia** entre entornos; lo único que cambia en el QR es `server`.

---

## Checklist para Case

- [ ] Pantalla (equipo de ventas): elegir negocio easy pos → botón "Generar QR".
- [ ] Al generar: `INSERT` en `dispositivo` (token 48 hex, `habilitado=true`).
- [ ] Mostrar el QR con `{"token":"…","server":"https://easypos.easypaybo.com"}`.
- [ ] Opcional: listar dispositivos del negocio con `last_seen`/`app_version` y
      un botón "Revocar" (`UPDATE dispositivo SET habilitado=false`).
- [ ] Etiqueta (`label`) para identificar cada equipo.

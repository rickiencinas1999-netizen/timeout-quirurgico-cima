# Lista de Verificación Quirúrgica (Time Out) — CIMA

Aplicación web para digitalizar la lista de verificación del paciente en procedimiento
quirúrgico (Time Out / Pausa Quirúrgica) que actualmente se llena en papel. Está
basada en el formato físico institucional y alineada con:

- La **Lista OMS de Verificación de la Cirugía Segura** (Sign In / Time Out / Sign Out).
- Los elementos mínimos de la **NOM-004-SSA3-2012** (expediente clínico) y
  **NOM-006-SSA3-2011** (práctica de la anestesiología: valoración preanestésica,
  vía aérea difícil, seguridad anestésica).
- Las Metas Internacionales de Seguridad del Paciente (identificación correcta del
  paciente, cirugía en el sitio correcto, procedimiento correcto).

Es una aplicación **independiente**, con su propio repositorio, sin relación de código
ni de datos con ningún otro proyecto clínico digitalizado del hospital.

## Qué incluye

- **Datos generales** del paciente y del procedimiento.
- **1ª verificación** — antes de la inducción anestésica (identificación del
  paciente, alergias, marcaje del sitio quirúrgico con mapa corporal interactivo,
  consentimiento, riesgo de hemorragia, valoración preanestésica, vía aérea difícil,
  disponibilidad de material e instrumental, etc.).
- **2ª verificación** — pausa quirúrgica antes de la incisión (equipo, paciente,
  procedimiento y sitio correctos, profilaxis antibiótica, esterilización,
  bloque opcional de precauciones por uso de láser).
- **3ª verificación** — antes de que el paciente salga de sala (confirmación
  verbal, conteo de instrumental/textil/agujas, patología, incidencias con
  material o equipo).
- **Trazabilidad de dispositivos médicos implantados** (dispositivo, fabricante,
  modelo, lote, serie, caducidad, sitio, cantidad).
- **Resumen** imprimible/exportable a PDF con las **alertas de seguridad**
  detectadas automáticamente (p. ej. vía aérea difícil, riesgo de hemorragia sin
  componentes disponibles, conteo de gasas/instrumental incompleto).
- **Historial de registros** con búsqueda, respaldo (exportar/importar JSON) y
  eliminación.
- **Enviar resumen por correo** a los destinatarios fijos del quirófano, con el
  detalle completo reactivo por reactivo.
- **Código QR para compartir la app** al final del resumen, y un **cartel
  imprimible** (`poster.html`) listo para pegar en la pared del hospital.

Cada reactivo se responde de forma explícita (Sí / No / N/A) — a diferencia de la
hoja física, donde algunos ítems solo tienen una casilla "Sí" — para evitar
ambigüedad entre "no se marcó" y "se verificó y es negativo", en línea con el
principio de verificación activa de la Lista OMS.

## Cómo usarla

El frontend (`index.html`, `css/`, `js/`) es HTML/CSS/JavaScript puro y no
necesita compilación. Los registros ya **no** se guardan solo en el navegador:
se guardan en un servidor compartido (ver [Guardado compartido entre
dispositivos](#guardado-compartido-entre-dispositivos-servidor)), así que la
primera vez que se abre la app en un dispositivo pide una **clave de acceso**
compartida del hospital.

1. Abra `index.html` directamente en el navegador, o sírvalo con cualquier
   servidor estático, por ejemplo:
   ```bash
   python3 -m http.server 8080
   ```
   y visite `http://localhost:8080`.
2. Introduzca la clave de acceso compartida (una sola vez por dispositivo).
3. Complete el formulario paso a paso (Datos generales → 1ª, 2ª y 3ª
   verificación → Implantes → Resumen). Si solo va a llenar hasta cierto
   punto (p. ej. preanestesia solo hace la 1ª verificación), use **"Guardar
   y continuar después"**: el siguiente turno podrá abrir el mismo registro
   desde otro dispositivo y seguirle.
4. En "Resumen" puede **imprimir / guardar como PDF** y **guardar el registro**
   como completo.
5. En "Historial" puede buscar, filtrar por "Solo incompletos", ver, continuar,
   eliminar o exportar/importar respaldos.

## Instalarla como app (PWA)

La app incluye `manifest.json`, íconos y un `service-worker.js`, así que se puede
**instalar** en el celular, tablet o computadora del personal (ícono propio,
pantalla completa, funciona sin conexión una vez cargada), siempre que se sirva
por **HTTPS** — no funciona el "Add to Home Screen" abriendo el archivo local.

La forma más simple es publicar el sitio con **GitHub Pages** (gratis, HTTPS
automático):

1. En GitHub → **Settings → General → Danger Zone → Change visibility** → hacer
   el repositorio **público** (Pages en cuentas gratuitas solo sirve repos
   públicos; el código no contiene datos de pacientes — esos viven en la base
   de datos del servidor compartido, nunca en el repositorio; ver [Guardado
   compartido entre dispositivos](#guardado-compartido-entre-dispositivos-servidor)).
2. **Settings → Pages → Build and deployment → Source**: `Deploy from a branch`
   → Branch: `main`, carpeta `/ (root)` → **Save**.
3. Tras uno o dos minutos, GitHub publica la URL (algo como
   `https://<usuario>.github.io/timeout-quirurgico-cima/`).
4. Desde el navegador del celular/tablet, abrir esa URL y usar la opción
   **"Agregar a pantalla de inicio"** / **"Instalar app"** (aparece automático
   en Chrome/Edge/Android; en iPhone/iPad es Safari → compartir → "Agregar a
   pantalla de inicio").

Cada vez que se actualice el código en `main`, GitHub Pages republica solo; no
hay paso de compilación.

## Cartel para pegar en la pared (código QR)

`poster.html` es una página aparte, lista para imprimir: trae el nombre del
hospital, un código QR grande que apunta a esta misma app y los pasos para
escanearlo e instalarla. Se abre sola (no necesita el resto de la app) desde
`https://<dominio-de-la-app>/poster.html`, o con el botón **"Ver / imprimir
cartel para pared"** que aparece al final del Resumen.

- El código QR se genera en el navegador con la librería vendorizada
  `js/qrcode.js` (MIT, Kazuhiko Arase) — no depende de ningún servicio externo.
- Está ajustado para caber siempre en una sola hoja **A4** al imprimir (botón
  "Imprimir cartel" o Ctrl/Cmd+P); en pantalla se ve de forma responsiva.

## Guardado compartido entre dispositivos (servidor)

Un mismo registro lo llenan **varias personas en momentos y lugares distintos**
(la 1ª verificación en preanestesia, la 2ª y 3ª ya dentro de quirófano), así
que la app ya no guarda solo en el `localStorage` del navegador: guarda en un
servidor compartido (`server/`, API en Node.js/Express + PostgreSQL,
desplegado en Render) para que cualquier dispositivo autorizado pueda abrir y
continuar el mismo registro.

- **`server/`** contiene la API (`server.js`) que expone `GET/POST/PUT/DELETE
  /api/registros`. Cada registro se guarda como JSON en PostgreSQL, con
  búsqueda por paciente/expediente/cirugía y una bandera `completo` para
  filtrar los que aún les falta alguna verificación.
- El frontend (`js/app.js`) habla con esa API por `fetch()`. Ya no hay
  ningún dato clínico guardado exclusivamente en el navegador salvo la clave
  de acceso del dispositivo.
- **Clave de acceso compartida (`APP_KEY`)**: no es una cuenta por persona,
  es una sola clave que se reparte al personal de quirófano/preanestesia y se
  captura una vez por dispositivo (queda guardada en `localStorage` de ese
  equipo). Sirve para que la URL de la API no quede abierta a cualquiera que
  la encuentre, **no es una autenticación clínica real por usuario** — quien
  tenga la clave y algo de conocimiento técnico podría en teoría extraerla del
  código público del navegador. Si el hospital necesita trazabilidad por
  usuario (quién llenó qué), eso requeriría una capa de login real, pendiente
  de evaluar con el área de sistemas.
- **Variables de entorno del servicio `server/`** (se configuran en Render,
  no se suben al repositorio):
  - `DATABASE_URL` — cadena de conexión de PostgreSQL.
  - `APP_KEY` — la clave compartida descrita arriba.
  - `ALLOWED_ORIGINS` — dominios permitidos por CORS (el dominio del
    frontend), separados por coma.
  - `PORT` — la asigna Render automáticamente.
  - `PGSSL=false` — solo para desarrollo local contra un Postgres sin SSL;
    en producción se deja sin definir (usa SSL).

### Aviso importante: plan gratuito de la base de datos

Por ahora la base de datos corre en el **plan gratuito de Render**, el cual
**se elimina automáticamente 30 días después de creada** (expira el
**2026-10-03**). Esto significa que, si no se actualiza a un plan de pago
antes de esa fecha, **se perderían todos los registros guardados**.

**Antes de usar esta app con pacientes reales**, es indispensable:

1. Actualizar la base de datos de Render a un **plan de pago** (elimina el
   borrado automático a los 30 días).
2. Definir con el hospital una política de respaldo (exportar periódicamente
   desde "Historial → Exportar todo (JSON)", además de la base de datos) y de
   resguardo legal de la información conforme a la NOM-004-SSA3-2012 y la
   normativa de protección de datos personales.
3. Evaluar con el área de sistemas del hospital si se requiere una capa de
   autenticación por usuario (más allá de la clave compartida) antes de
   integrarlo como reemplazo formal del papel.

También hay que considerar que el **servicio web gratuito** de Render "se
duerme" tras ~15 minutos sin uso: la primera solicitud después de ese tiempo
puede tardar entre 30 y 60 segundos en responder mientras el servidor
despierta. Para uso institucional constante conviene un plan de pago que
evite esta pausa.

Esta herramienta es un apoyo para la digitalización y estandarización del llenado;
no sustituye el juicio clínico del equipo quirúrgico ni los procesos de calidad y
seguridad del paciente ya establecidos en la institución.

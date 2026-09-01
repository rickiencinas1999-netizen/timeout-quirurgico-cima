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

Cada reactivo se responde de forma explícita (Sí / No / N/A) — a diferencia de la
hoja física, donde algunos ítems solo tienen una casilla "Sí" — para evitar
ambigüedad entre "no se marcó" y "se verificó y es negativo", en línea con el
principio de verificación activa de la Lista OMS.

## Cómo usarla

No requiere instalación ni backend: es HTML/CSS/JavaScript puro.

1. Abra `index.html` directamente en el navegador, o sírvalo con cualquier
   servidor estático, por ejemplo:
   ```bash
   python3 -m http.server 8080
   ```
   y visite `http://localhost:8080`.
2. Complete el formulario paso a paso (Datos generales → 1ª, 2ª y 3ª
   verificación → Implantes → Resumen).
3. En "Resumen" puede **imprimir / guardar como PDF** y **guardar el registro**.
4. En "Historial" puede buscar, ver, eliminar o exportar/importar respaldos.

## Aviso importante sobre los datos

Los registros se guardan **únicamente en el almacenamiento local (`localStorage`)
del navegador/dispositivo donde se usa la app**; no se envían a ningún servidor.
Esto significa que:

- Los datos **no se sincronizan** entre equipos ni usuarios.
- Si se borra la caché del navegador o se cambia de dispositivo, se pierde el
  historial local, a menos que se haya exportado previamente (botón
  "Exportar todo (JSON)").
- Para un uso institucional en producción (múltiples quirófanos, integración con
  el expediente clínico electrónico, resguardo legal de la información conforme a
  la NOM-004-SSA3-2012 y a la normativa de protección de datos personales),
  se recomienda evaluar con el área de sistemas del hospital una capa de
  almacenamiento centralizada y segura antes de sustituir el formato físico.

Esta herramienta es un apoyo para la digitalización y estandarización del llenado;
no sustituye el juicio clínico del equipo quirúrgico ni los procesos de calidad y
seguridad del paciente ya establecidos en la institución.

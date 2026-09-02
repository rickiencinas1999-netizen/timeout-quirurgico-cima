"use strict";

/* =========================================================================
   Lista de Verificación Quirúrgica (Time Out) — lógica de la aplicación
   Almacenamiento: localStorage del navegador (sin backend).
   ========================================================================= */

const STORAGE_KEY = "cima_timeout_registros_v1";

/* ---- Catálogo de reactivos por fase (id debe coincidir con data-item) --- */
const ITEM_DEFS = {
  v1: [
    { id: "pacienteCorrecto", label: "Paciente correcto. Se corroboraron los dos identificadores con pulsera de identificación." },
    { id: "pacienteDiceProcedimiento", label: "El paciente dice el procedimiento a realizarse." },
    { id: "alergias", label: "Alergias conocidas.", flagOn: "si" },
    { id: "sitioMarcado", label: "Está marcado el sitio quirúrgico a intervenir.", flagOn: "no" },
    { id: "marcajeNoPosible", label: "El marcaje del sitio quirúrgico NO es posible.", optional: true },
    { id: "estudiosDisponibles", label: "Estudios e imágenes diagnósticas disponibles." },
    { id: "profilaxisV1", label: "¿Profilaxis antibiótica administrada?" },
    { id: "consentimiento", label: "Consentimiento informado.", flagOn: "no", critical: true },
    { id: "riesgoHemorragia", label: "Riesgo de hemorragia.", flagOn: "si" },
    { id: "componentesSanguineos", label: "Disponibilidad de componentes sanguíneos (doble vía)." },
    { id: "valoracionPreanestesica", label: "Valoración preanestésica realizada.", flagOn: "no" },
    { id: "viaAereaDificil", label: "Vía aérea difícil identificada.", flagOn: "si" },
    { id: "seguridadAnestesica", label: "Seguridad anestésica completada.", flagOn: "no" },
    { id: "materialDisponible", label: "Material, instrumental, medicamentos y equipo electromédico disponibles.", flagOn: "no" },
    { id: "vigenciaVerificada", label: "Vigencia de materiales e instrumental verificada.", flagOn: "no" },
  ],
  v2: [
    { id: "equipoCompleto", label: "Equipo quirúrgico completo.", flagOn: "no", critical: true },
    { id: "pacienteCorrectoV2", label: "Paciente correcto.", flagOn: "no", critical: true },
    { id: "procedimientoCorrecto", label: "Procedimiento correcto.", flagOn: "no", critical: true },
    { id: "sitioCorrectoV2", label: "Sitio quirúrgico correcto (si aplica).", flagOn: "no", critical: true },
    { id: "esterilizacionVerificada", label: "Verificación de indicadores de esterilización.", flagOn: "no" },
    { id: "monitoreoTemperatura", label: "Monitoreo de temperatura continua colocado." },
  ],
  v3: [
    { id: "procedimientoConfirmado", label: "Se confirma procedimiento realizado.", flagOn: "no" },
    { id: "conteoCompleto", label: "Cuenta de instrumental, textil y agujas completa.", flagOn: "no", critical: true },
    { id: "patologiaEtiquetada", label: "Pieza de patología etiquetada y en solución conservadora." },
    { id: "enviadaPatologia", label: "Pieza enviada a patología.", optional: true },
    { id: "problemasMaterial", label: "¿Existen problemas que reportar (material/equipo)?", flagOn: "si" },
  ],
};

const STEP_COUNT = 6;

/* ------------------------------- Estado --------------------------------- */
let currentStep = 0;
let editingId = null; // id del registro en edición (si viene del historial)
let formIsDirty = false; // hay cambios sin guardar desde el último newRecord/loadRecordIntoForm/guardado

/* ============================== Utilidades =============================== */
function uid() {
  return "reg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 2600);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ===================== Construcción de controles Sí/No/NA ================= */
function buildSegmentedControls() {
  document.querySelectorAll(".item__answer[data-options]").forEach((el) => {
    const opts = el.getAttribute("data-options").split(",");
    const labelMap = { si: "Sí", no: "No", na: "N/A" };
    el.innerHTML = opts.map(
      (o) => `<button type="button" class="seg-btn" data-val="${o}">${labelMap[o]}</button>`
    ).join("");
  });

  document.querySelectorAll(".item__answer .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.parentElement;
      const item = btn.closest(".item");
      group.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      group.dataset.value = btn.dataset.val;
      item.classList.remove("is-unanswered");
      applyConditionalVisibility();
    });
  });
}

/* ===================== Visibilidad condicional (data-show-if) ============= */
function applyConditionalVisibility() {
  document.querySelectorAll("[data-show-if]").forEach((el) => {
    const [itemId, expected] = el.getAttribute("data-show-if").split("=");
    const sourceItem = document.querySelector(`.item[data-item="${itemId}"]`);
    const val = sourceItem?.querySelector(".item__answer")?.dataset.value;
    el.hidden = val !== expected;
  });
  updateProfilaxisEcho();
}

/* ===================== Eco de profilaxis (V1 -> V2, sin volver a preguntar) === */
function updateProfilaxisEcho() {
  const echo = document.getElementById("profilaxisEcho");
  if (!echo) return;
  const item = document.querySelector('.item[data-item="profilaxisV1"]');
  const value = item?.querySelector(".item__answer")?.dataset.value;
  const { detalle } = item ? readItemDetail("profilaxisV1") : { detalle: "" };
  if (!value) {
    echo.textContent = "Aún no se ha registrado en la 1ª verificación.";
    echo.classList.add("item__echo--empty");
  } else {
    echo.textContent = `${ANSWER_LABEL[value]}${detalle ? " — " + detalle : ""} (registrado en la 1ª verificación)`;
    echo.classList.remove("item__echo--empty");
  }
}

/* ================================ Mapa corporal ============================ */
function buildBodyMap() {
  const container = document.getElementById("bodymap");
  const views = [
    { key: "frente", label: "Frente" },
    { key: "espalda", label: "Espalda" },
  ];
  container.innerHTML = views.map((v) => `
    <figure style="margin:0;text-align:center">
      <svg data-view="${v.key}" width="120" height="240" viewBox="0 0 120 240">
        <circle cx="60" cy="26" r="20" fill="none" stroke="#5c7370" stroke-width="2"/>
        <line x1="60" y1="46" x2="60" y2="130" stroke="#5c7370" stroke-width="2"/>
        <line x1="60" y1="60" x2="20" y2="120" stroke="#5c7370" stroke-width="2"/>
        <line x1="60" y1="60" x2="100" y2="120" stroke="#5c7370" stroke-width="2"/>
        <line x1="60" y1="130" x2="35" y2="220" stroke="#5c7370" stroke-width="2"/>
        <line x1="60" y1="130" x2="85" y2="220" stroke="#5c7370" stroke-width="2"/>
        <rect x="35" y="55" width="50" height="80" rx="16" fill="none" stroke="#5c7370" stroke-width="2"/>
        <g class="pins"></g>
      </svg>
      <figcaption style="font-size:.72rem;color:var(--ink-500)">${v.label}</figcaption>
    </figure>
  `).join("");

  container.querySelectorAll("svg").forEach((svg) => {
    svg.addEventListener("click", (e) => {
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 120;
      const y = ((e.clientY - rect.top) / rect.height) * 240;
      svg.querySelector(".pins").innerHTML = "";
      const pin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pin.setAttribute("cx", x.toFixed(1));
      pin.setAttribute("cy", y.toFixed(1));
      pin.setAttribute("r", "6");
      pin.setAttribute("class", "pin");
      svg.querySelector(".pins").appendChild(pin);
      svg.dataset.x = (x / 120).toFixed(3);
      svg.dataset.y = (y / 240).toFixed(3);
      container.querySelectorAll("svg").forEach((s) => {
        if (s !== svg) { s.dataset.x = ""; s.dataset.y = ""; s.querySelector(".pins").innerHTML = ""; }
      });
    });
  });
}
function getBodyMapMark() {
  const svg = document.querySelector("#bodymap svg[data-x]:not([data-x=''])");
  if (!svg) return null;
  return { vista: svg.dataset.view, x: Number(svg.dataset.x), y: Number(svg.dataset.y) };
}
function setBodyMapMark(mark) {
  document.querySelectorAll("#bodymap svg").forEach((svg) => {
    svg.dataset.x = ""; svg.dataset.y = "";
    svg.querySelector(".pins").innerHTML = "";
  });
  if (!mark) return;
  const svg = document.querySelector(`#bodymap svg[data-view="${mark.vista}"]`);
  if (!svg) return;
  const x = mark.x * 120, y = mark.y * 240;
  const pin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pin.setAttribute("cx", x.toFixed(1));
  pin.setAttribute("cy", y.toFixed(1));
  pin.setAttribute("r", "6");
  pin.setAttribute("class", "pin");
  svg.querySelector(".pins").appendChild(pin);
  svg.dataset.x = mark.x; svg.dataset.y = mark.y;
}

/* ================================ Implantes ================================ */
const IMPLANT_FIELDS = ["dispositivo", "fabricante", "proveedor", "modelo", "lote", "serie", "caducidad", "sitio", "cantidad"];

function addImplantRow(data = {}) {
  const tbody = document.getElementById("implantRows");
  const tr = document.createElement("tr");
  tr.innerHTML = IMPLANT_FIELDS.map((f) => {
    const type = f === "caducidad" ? "date" : f === "cantidad" ? "number" : "text";
    return `<td><input type="${type}" data-field="${f}" value="${escapeHtml(data[f] || "")}"></td>`;
  }).join("") + `<td class="rm"><button type="button" class="btn btn--danger" data-rm>✕</button></td>`;
  tr.querySelector("[data-rm]").addEventListener("click", () => tr.remove());
  tbody.appendChild(tr);
}
function getImplantRows() {
  return Array.from(document.querySelectorAll("#implantRows tr")).map((tr) => {
    const row = {};
    IMPLANT_FIELDS.forEach((f) => { row[f] = tr.querySelector(`[data-field="${f}"]`).value.trim(); });
    return row;
  }).filter((row) => Object.values(row).some((v) => v));
}

/* ================================ Navegación ================================ */
function goToStep(n) {
  currentStep = Math.max(0, Math.min(STEP_COUNT - 1, n));
  document.querySelectorAll(".step").forEach((s) => { s.hidden = Number(s.dataset.step) !== currentStep; });
  document.querySelectorAll("#stepper li").forEach((li) => {
    const idx = Number(li.dataset.step);
    li.classList.toggle("is-active", idx === currentStep);
    li.classList.toggle("is-done", idx < currentStep);
  });
  document.getElementById("prevStepBtn").disabled = currentStep === 0;
  document.getElementById("nextStepBtn").hidden = currentStep === STEP_COUNT - 1;
  updateProfilaxisEcho();
  if (currentStep === STEP_COUNT - 1) renderSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateCurrentStep() {
  const stepEl = document.querySelector(`.step[data-step="${currentStep}"]`);
  let ok = true;
  // Validar campos de texto requeridos
  stepEl.querySelectorAll("input[required]").forEach((inp) => {
    if (!inp.value) { inp.style.borderColor = "var(--danger)"; ok = false; }
    else inp.style.borderColor = "";
  });
  // Validar reactivos Sí/No/NA visibles y no opcionales
  stepEl.querySelectorAll(".checklist .item:not([hidden])").forEach((item) => {
    const answer = item.querySelector(".item__answer");
    if (answer && !answer.dataset.value) {
      item.classList.add("is-unanswered", "is-touched");
      ok = false;
    }
  });
  if (!ok) showToast("Complete los campos marcados antes de continuar.");
  return ok;
}

/* ================================ Recolección ================================ */
const DETAIL_FIELD_LABELS = {
  hora: "Hora", medicamento: "Medicamento", dosis: "Dosis", via: "Vía",
  cantidad: "Cantidad", tipo: "Tipo", proveedor: "Proveedor", temperatura: "Temp. inicial",
};

function readItemDetail(id) {
  // Los campos de detalle no siempre viven dentro del div de su propio ítem
  // (p. ej. el proveedor de materialDisponible se muestra bajo vigenciaVerificada),
  // así que se buscan en todo el documento por su id, que es único por página.
  const fields = document.querySelectorAll(`[data-detail-for="${id}"][data-detail-field]`);
  if (fields.length) {
    const campos = {};
    fields.forEach((el) => { campos[el.dataset.detailField] = el.value.trim(); });
    const detalle = Object.entries(campos)
      .filter(([, v]) => v)
      .map(([k, v]) => (k === "hora" ? v : `${DETAIL_FIELD_LABELS[k] || k}: ${v}`))
      .join(" · ");
    return { detalle, campos };
  }
  const detailEl = document.querySelector(`[data-detail-for="${id}"]`);
  return { detalle: detailEl ? detailEl.value.trim() : "" };
}

function collectPhaseAnswers(phase) {
  const answers = {};
  document.querySelectorAll(`.checklist[data-phase="${phase}"] .item`).forEach((item) => {
    const id = item.dataset.item;
    const answerEl = item.querySelector(".item__answer");
    const value = answerEl ? answerEl.dataset.value || null : null;
    answers[id] = { value, ...readItemDetail(id) };
  });
  return answers;
}

function collectForm() {
  const form = document.getElementById("checklistForm");
  const fd = new FormData(form);
  const general = {
    fecha: fd.get("fecha"), horaInicio: fd.get("horaInicio"), sala: fd.get("sala"),
    paciente: fd.get("paciente"), expediente: fd.get("expediente"), edad: fd.get("edad"),
    cirugia: fd.get("cirugia"), cirujano: fd.get("cirujano"), anestesiologo: fd.get("anestesiologo"),
  };
  const sitio = {
    sitioAnatomico: fd.get("sitioAnatomico"), lateralidad: fd.get("lateralidad"), marca: getBodyMapMark(),
  };
  const record = {
    id: editingId || uid(),
    creadoEn: editingId ? (window.__recordCreatedAt || new Date().toISOString()) : new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    general, sitio,
    v1: { respuestas: collectPhaseAnswers("v1"), verificadoPor: fd.get("v1_verificadoPor"), hora: fd.get("v1_hora") },
    v2: {
      respuestas: collectPhaseAnswers("v2"), verificadoPor: fd.get("v2_verificadoPor"), hora: fd.get("v2_hora"),
      laser: {
        usa: document.getElementById("usaLaser").checked,
        epp: form.laser_epp.checked, senalizacion: form.laser_senalizacion.checked, ventana: form.laser_ventana.checked,
        proveedor: form.laser_proveedor.value.trim(),
      },
    },
    v3: { respuestas: collectPhaseAnswers("v3"), verificadoPor: fd.get("v3_verificadoPor"), hora: fd.get("v3_hora") },
    implantes: { usa: document.getElementById("usaImplante").checked, dispositivos: getImplantRows() },
  };
  return record;
}

/* ================================ Alertas clínicas ============================ */
function computeAlerts(record) {
  const alerts = [];
  ["v1", "v2", "v3"].forEach((phase) => {
    ITEM_DEFS[phase].forEach((def) => {
      const ans = record[phase].respuestas[def.id];
      if (!ans || !def.flagOn) return;
      if (ans.value === def.flagOn) {
        alerts.push({
          critical: !!def.critical,
          text: def.label + (ans.detalle ? ` — ${ans.detalle}` : ""),
        });
      }
    });
  });
  if (record.v1.respuestas.riesgoHemorragia?.value === "si" &&
      record.v1.respuestas.componentesSanguineos?.value !== "si") {
    alerts.push({ critical: true, text: "Riesgo de hemorragia sin confirmación de componentes sanguíneos disponibles." });
  }
  return alerts;
}

function phaseCompleteness(record, phase) {
  const total = ITEM_DEFS[phase].filter((d) => !d.optional).length;
  const answered = ITEM_DEFS[phase].filter((d) => !d.optional && record[phase].respuestas[d.id]?.value).length;
  const signed = !!(record[phase].verificadoPor && record[phase].hora);
  return { total, answered, complete: answered === total && signed };
}

/* ================================ Resumen ================================ */
const ANSWER_LABEL = { si: "Sí", no: "No", na: "N/A" };

function renderSummary() {
  const record = collectForm();
  const alerts = computeAlerts(record);
  const c1 = phaseCompleteness(record, "v1");
  const c2 = phaseCompleteness(record, "v2");
  const c3 = phaseCompleteness(record, "v3");
  const allComplete = c1.complete && c2.complete && c3.complete;

  const phaseHtml = (phase, title, extraHtml = "") => `
    <div class="summary-block">
      <h3>${title}</h3>
      ${extraHtml}
      <ul class="summary-list">
        ${ITEM_DEFS[phase].map((d) => {
          const ans = record[phase].respuestas[d.id];
          if (!ans?.value) return `<li><span>${escapeHtml(d.label)}</span><b>Sin responder</b></li>`;
          return `<li><span>${escapeHtml(d.label)}${ans.detalle ? " — " + escapeHtml(ans.detalle) : ""}</span><b>${ANSWER_LABEL[ans.value]}</b></li>`;
        }).join("")}
      </ul>
      <p style="margin-top:8px;font-size:.82rem;color:var(--ink-500)">
        Verificó: <b>${escapeHtml(record[phase].verificadoPor || "—")}</b> · Hora: <b>${escapeHtml(record[phase].hora || "—")}</b>
      </p>
    </div>`;

  const profV1 = record.v1.respuestas.profilaxisV1;
  const profilaxisNote = `<p class="summary-note"><b>Profilaxis antibiótica:</b> ${
    profV1?.value ? ANSWER_LABEL[profV1.value] + (profV1.detalle ? " — " + escapeHtml(profV1.detalle) : "") : "Sin registrar"
  } <i>(tomado de la 1ª verificación)</i></p>`;

  let laserNote = "";
  if (record.v2.laser?.usa) {
    const l = record.v2.laser;
    const medidas = [l.epp && "EPP", l.senalizacion && "señalización", l.ventana && "protección de ventana"].filter(Boolean).join(", ") || "ninguna marcada";
    laserNote = `<p class="summary-note"><b>Láser:</b> en uso · Medidas: ${escapeHtml(medidas)}${l.proveedor ? " · Proveedor: " + escapeHtml(l.proveedor) : ""}</p>`;
  }

  let implantHtml = "";
  if (record.implantes.usa && record.implantes.dispositivos.length) {
    implantHtml = `
      <div class="summary-block">
        <h3>Dispositivos médicos implantados</h3>
        <ul class="summary-list">
          ${record.implantes.dispositivos.map((d) => `<li><span>${escapeHtml(d.dispositivo || "(sin nombre)")} — ${escapeHtml(d.fabricante || "")}${d.proveedor ? " · Prov: " + escapeHtml(d.proveedor) : ""}</span><b>Lote ${escapeHtml(d.lote || "—")} · Serie ${escapeHtml(d.serie || "—")}</b></li>`).join("")}
        </ul>
      </div>`;
  }

  const alertHtml = alerts.length
    ? `<div class="alert-box alert-box--danger"><b>Puntos de atención (${alerts.length})</b><ul>${alerts.map((a) => `<li>${a.critical ? "⚠ " : ""}${escapeHtml(a.text)}</li>`).join("")}</ul></div>`
    : `<div class="alert-box alert-box--ok">Sin puntos de atención detectados en las respuestas capturadas.</div>`;

  const statusHtml = allComplete
    ? `<div class="alert-box alert-box--ok">Las tres verificaciones están completas y firmadas.</div>`
    : `<div class="alert-box alert-box--danger">Registro incompleto: V1 ${c1.answered}/${c1.total} · V2 ${c2.answered}/${c2.total} · V3 ${c3.answered}/${c3.total}. Puede guardar como borrador y continuar después.</div>`;

  document.getElementById("summaryContent").innerHTML = `
    <div class="summary-block">
      <h3>Datos generales</h3>
      <div class="summary-grid">
        <div><b>Paciente:</b> ${escapeHtml(record.general.paciente || "—")}</div>
        <div><b>Expediente:</b> ${escapeHtml(record.general.expediente || "—")}</div>
        <div><b>Fecha:</b> ${escapeHtml(record.general.fecha || "—")}</div>
        <div><b>Sala:</b> ${escapeHtml(record.general.sala || "—")}</div>
        <div><b>Cirugía:</b> ${escapeHtml(record.general.cirugia || "—")}</div>
        <div><b>Cirujano:</b> ${escapeHtml(record.general.cirujano || "—")}</div>
        <div><b>Anestesiólogo(a):</b> ${escapeHtml(record.general.anestesiologo || "—")}</div>
        <div><b>Sitio/lateralidad:</b> ${escapeHtml(record.sitio.sitioAnatomico || "—")} · ${escapeHtml(record.sitio.lateralidad || "—")}</div>
      </div>
    </div>
    ${statusHtml}
    ${alertHtml}
    ${phaseHtml("v1", "1ª Verificación — Antes de la inducción anestésica")}
    ${phaseHtml("v2", "2ª Verificación — Pausa quirúrgica", profilaxisNote + laserNote)}
    ${phaseHtml("v3", "3ª Verificación — Antes de salir de sala")}
    ${implantHtml}
  `;
  window.__lastComputedRecord = record;
  window.__lastComputedAlerts = alerts;
  window.__lastComputedComplete = allComplete;
  renderShareQr();
}

/* ================================ Compartir la app (QR) ================================ */
function renderShareQr() {
  const container = document.getElementById("shareQr");
  if (!container || container.dataset.rendered) return;
  const appUrl = new URL("./", location.href).toString();
  const qr = qrcode(0, "M");
  qr.addData(appUrl);
  qr.make();
  container.innerHTML = qr.createSvgTag({ scalable: true });
  container.dataset.rendered = "1";
}

/* ================================ Envío por correo ================================ */
const EMAIL_RECIPIENTS = [
  "jefequirofano@cimahermosillo.com",
  "amann@cimahermosillo.com",
  "vburgosn@cimahermosillo.com",
];

function buildSummaryText() {
  // Cuerpo completo, reactivo por reactivo (igual que el resumen en pantalla).
  // Nota: algunos clientes de correo de escritorio antiguos truncan enlaces
  // "mailto" muy largos; con muchas alertas y textos libres extensos esto
  // podría no verse completo en esos casos. El registro guardado y el PDF
  // impreso siempre conservan el detalle íntegro.
  const record = collectForm();
  const alerts = computeAlerts(record);
  const c1 = phaseCompleteness(record, "v1");
  const c2 = phaseCompleteness(record, "v2");
  const c3 = phaseCompleteness(record, "v3");
  const allComplete = c1.complete && c2.complete && c3.complete;
  const lines = [];

  lines.push("RESUMEN — LISTA DE VERIFICACIÓN QUIRÚRGICA (TIME OUT) — CIMA");
  lines.push("");
  lines.push(`Paciente: ${record.general.paciente || "—"}   Expediente: ${record.general.expediente || "—"}`);
  lines.push(`Fecha: ${record.general.fecha || "—"}   Sala: ${record.general.sala || "—"}`);
  lines.push(`Cirugía: ${record.general.cirugia || "—"}`);
  lines.push(`Cirujano: ${record.general.cirujano || "—"}   Anestesiólogo(a): ${record.general.anestesiologo || "—"}`);
  lines.push(`Sitio/lateralidad: ${record.sitio.sitioAnatomico || "—"} · ${record.sitio.lateralidad || "—"}`);
  lines.push("");
  lines.push(allComplete
    ? "Estado: las tres verificaciones están completas y firmadas."
    : `Estado: registro incompleto (V1 ${c1.answered}/${c1.total} · V2 ${c2.answered}/${c2.total} · V3 ${c3.answered}/${c3.total}).`);
  lines.push("");

  lines.push(`PUNTOS DE ATENCIÓN (${alerts.length})`);
  if (alerts.length) {
    alerts.forEach((a) => lines.push(`- ${a.critical ? "[!] " : ""}${a.text}`));
  } else {
    lines.push("- Ninguno detectado en las respuestas capturadas.");
  }
  lines.push("");

  const phaseText = (phase, title, extraLines = []) => {
    lines.push(title);
    extraLines.forEach((l) => lines.push(l));
    ITEM_DEFS[phase].forEach((d) => {
      const ans = record[phase].respuestas[d.id];
      const val = ans?.value ? ANSWER_LABEL[ans.value] : "Sin responder";
      lines.push(`- ${d.label}${ans?.detalle ? " — " + ans.detalle : ""}: ${val}`);
    });
    lines.push(`Verificó: ${record[phase].verificadoPor || "—"} · Hora: ${record[phase].hora || "—"}`);
    lines.push("");
  };

  phaseText("v1", "1ª VERIFICACIÓN — Antes de la inducción anestésica");

  const profV1 = record.v1.respuestas.profilaxisV1;
  const profilaxisLine = `- Profilaxis antibiótica: ${profV1?.value ? ANSWER_LABEL[profV1.value] + (profV1.detalle ? " — " + profV1.detalle : "") : "Sin registrar"} (tomado de la 1ª verificación)`;
  const v2Extra = [profilaxisLine];
  if (record.v2.laser?.usa) {
    const l = record.v2.laser;
    const medidas = [l.epp && "EPP", l.senalizacion && "señalización", l.ventana && "protección de ventana"].filter(Boolean).join(", ") || "ninguna marcada";
    v2Extra.push(`- Láser: en uso · Medidas: ${medidas}${l.proveedor ? " · Proveedor: " + l.proveedor : ""}`);
  }
  phaseText("v2", "2ª VERIFICACIÓN — Pausa quirúrgica", v2Extra);

  phaseText("v3", "3ª VERIFICACIÓN — Antes de salir de sala");

  if (record.implantes.usa && record.implantes.dispositivos.length) {
    lines.push("DISPOSITIVOS MÉDICOS IMPLANTADOS");
    record.implantes.dispositivos.forEach((d) => {
      lines.push(`- ${d.dispositivo || "(sin nombre)"} — ${d.fabricante || ""}${d.proveedor ? " · Prov: " + d.proveedor : ""} · Lote ${d.lote || "—"} · Serie ${d.serie || "—"}`);
    });
    lines.push("");
  }

  lines.push("—");
  lines.push("Generado desde la app Time Out Quirúrgico (CIMA). No sustituye el expediente clínico oficial.");

  return { text: lines.join("\n"), record };
}

function sendSummaryByEmail() {
  const { text, record } = buildSummaryText();
  const subject = `Resumen Time Out — ${record.general.paciente || "paciente"} — ${record.general.fecha || ""}`;
  const to = EMAIL_RECIPIENTS.join(",");
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  window.location.href = mailto;
}

/* ================================ Guardar / Historial ============================ */
function saveCurrentRecord() {
  const record = collectForm();
  record.alertas = computeAlerts(record);
  record.completo = ["v1", "v2", "v3"].every((p) => phaseCompleteness(record, p).complete);
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record; else records.push(record);
  saveRecords(records);
  editingId = record.id;
  window.__recordCreatedAt = record.creadoEn;
  formIsDirty = false;
  showToast("Registro guardado en este dispositivo.");
  renderHistory();
}

function resetAllAnswers() {
  document.querySelectorAll(".seg-btn.is-selected").forEach((b) => b.classList.remove("is-selected"));
  document.querySelectorAll(".item__answer").forEach((el) => delete el.dataset.value);
  document.querySelectorAll(".item").forEach((el) => el.classList.remove("is-unanswered", "is-touched"));
  document.querySelectorAll("[data-detail-for]").forEach((el) => { el.value = ""; });
}

function newRecord() {
  editingId = null;
  window.__recordCreatedAt = null;
  formIsDirty = false;
  document.getElementById("checklistForm").reset();
  resetAllAnswers();
  setBodyMapMark(null);
  document.getElementById("implantRows").innerHTML = "";
  document.getElementById("implantesBlock").hidden = true;
  document.getElementById("usaImplante").checked = false;
  document.getElementById("laserOptions").hidden = true;
  document.getElementById("usaLaser").checked = false;
  applyConditionalVisibility();
  const form = document.getElementById("checklistForm");
  form.fecha.value = todayISO();
  form.horaInicio.value = nowHM();
  form.v1_hora.value = nowHM();
  form.v2_hora.value = nowHM();
  form.v3_hora.value = nowHM();
  goToStep(0);
}

function loadRecordIntoForm(record) {
  editingId = record.id;
  window.__recordCreatedAt = record.creadoEn;
  formIsDirty = false;
  const form = document.getElementById("checklistForm");
  form.reset();
  resetAllAnswers();
  Object.entries(record.general).forEach(([k, v]) => { if (form[k]) form[k].value = v || ""; });
  if (form.sitioAnatomico) form.sitioAnatomico.value = record.sitio?.sitioAnatomico || "";
  if (form.lateralidad) form.lateralidad.value = record.sitio?.lateralidad || "";
  setBodyMapMark(record.sitio?.marca || null);

  ["v1", "v2", "v3"].forEach((phase) => {
    Object.entries(record[phase].respuestas).forEach(([id, ans]) => {
      const item = document.querySelector(`.item[data-item="${id}"]`);
      if (!item) return;
      const answerEl = item.querySelector(".item__answer");
      if (answerEl && ans.value) {
        answerEl.dataset.value = ans.value;
        answerEl.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-selected", b.dataset.val === ans.value));
      }
      const fieldEls = document.querySelectorAll(`[data-detail-for="${id}"][data-detail-field]`);
      if (fieldEls.length) {
        fieldEls.forEach((el) => { el.value = ans.campos?.[el.dataset.detailField] || ""; });
      } else {
        const detailEl = document.querySelector(`[data-detail-for="${id}"]`);
        if (detailEl) detailEl.value = ans.detalle || "";
      }
    });
    form[`${phase}_verificadoPor`].value = record[phase].verificadoPor || "";
    form[`${phase}_hora`].value = record[phase].hora || "";
  });

  document.getElementById("usaLaser").checked = !!record.v2.laser?.usa;
  document.getElementById("laserOptions").hidden = !record.v2.laser?.usa;
  form.laser_epp.checked = !!record.v2.laser?.epp;
  form.laser_senalizacion.checked = !!record.v2.laser?.senalizacion;
  form.laser_ventana.checked = !!record.v2.laser?.ventana;
  form.laser_proveedor.value = record.v2.laser?.proveedor || "";

  document.getElementById("implantRows").innerHTML = "";
  document.getElementById("usaImplante").checked = !!record.implantes?.usa;
  document.getElementById("implantesBlock").hidden = !record.implantes?.usa;
  (record.implantes?.dispositivos || []).forEach(addImplantRow);

  applyConditionalVisibility();
  goToStep(0);
}

function deleteRecord(id) {
  if (!confirm("¿Eliminar este registro de forma permanente de este dispositivo?")) return;
  saveRecords(loadRecords().filter((r) => r.id !== id));
  renderHistory();
  showToast("Registro eliminado.");
}

function renderHistory() {
  const records = loadRecords().sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || ""));
  const query = (document.getElementById("historySearch").value || "").toLowerCase();
  const filtered = records.filter((r) => {
    const hay = `${r.general.paciente} ${r.general.expediente} ${r.general.cirugia}`.toLowerCase();
    return hay.includes(query);
  });
  const tbody = document.getElementById("historyRows");
  document.getElementById("historyEmpty").hidden = records.length !== 0;
  tbody.innerHTML = filtered.map((r) => {
    const alerts = r.alertas || computeAlerts(r);
    const critCount = alerts.filter((a) => a.critical).length;
    const estadoBadge = r.completo
      ? `<span class="badge badge--ok">Completo</span>`
      : `<span class="badge badge--warn">Incompleto</span>`;
    const alertBadge = alerts.length
      ? `<span class="badge ${critCount ? "badge--danger" : "badge--warn"}">${alerts.length}</span>`
      : `<span class="badge badge--ok">0</span>`;
    return `
      <tr>
        <td data-label="Fecha">${escapeHtml(r.general.fecha || "—")}</td>
        <td data-label="Paciente">${escapeHtml(r.general.paciente || "—")}</td>
        <td data-label="Expediente">${escapeHtml(r.general.expediente || "—")}</td>
        <td data-label="Cirugía">${escapeHtml(r.general.cirugia || "—")}</td>
        <td data-label="Estado">${estadoBadge}</td>
        <td data-label="Alertas">${alertBadge}</td>
        <td class="row-actions" data-label="Acciones">
          <button class="btn btn--ghost" data-act="ver" data-id="${r.id}">Ver</button>
          <button class="btn btn--danger" data-act="borrar" data-id="${r.id}">Eliminar</button>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-act='ver']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rec = loadRecords().find((r) => r.id === btn.dataset.id);
      if (rec) { loadRecordIntoForm(rec); switchView("form"); goToStep(5); }
    });
  });
  tbody.querySelectorAll("[data-act='borrar']").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecord(btn.dataset.id));
  });
}

/* ================================ Vistas ================================ */
function switchView(view) {
  document.getElementById("view-form").hidden = view !== "form";
  document.getElementById("view-history").hidden = view !== "history";
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === view));
  if (view === "history") renderHistory();
}

/* ================================ Exportar / Importar ================================ */
function exportAll() {
  const data = JSON.stringify(loadRecords(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timeout_quirurgico_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importAll(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("Formato inválido");
      const existing = loadRecords();
      const byId = new Map(existing.map((r) => [r.id, r]));
      incoming.forEach((r) => byId.set(r.id, r));
      saveRecords(Array.from(byId.values()));
      renderHistory();
      showToast(`Se importaron ${incoming.length} registro(s).`);
    } catch (e) {
      showToast("No se pudo importar el archivo (formato inválido).");
    }
  };
  reader.readAsText(file);
}

/* ================================ Inicialización ================================ */
document.addEventListener("DOMContentLoaded", () => {
  buildSegmentedControls();
  buildBodyMap();
  applyConditionalVisibility();

  const checklistForm = document.getElementById("checklistForm");
  ["input", "change", "click"].forEach((evt) => {
    checklistForm.addEventListener(evt, () => { formIsDirty = true; });
  });

  document.querySelectorAll("#stepper li").forEach((li) => {
    li.addEventListener("click", () => goToStep(Number(li.dataset.step)));
  });
  document.getElementById("prevStepBtn").addEventListener("click", () => goToStep(currentStep - 1));
  document.getElementById("nextStepBtn").addEventListener("click", () => {
    if (validateCurrentStep()) goToStep(currentStep + 1);
  });

  document.getElementById("usaLaser").addEventListener("change", (e) => {
    document.getElementById("laserOptions").hidden = !e.target.checked;
  });
  document.getElementById("usaImplante").addEventListener("change", (e) => {
    document.getElementById("implantesBlock").hidden = !e.target.checked;
    if (e.target.checked && !document.getElementById("implantRows").children.length) addImplantRow();
  });
  document.getElementById("addImplantRow").addEventListener("click", () => addImplantRow());

  document.getElementById("checklistForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveCurrentRecord();
  });
  document.getElementById("printSummaryBtn").addEventListener("click", () => {
    renderSummary();
    window.print();
  });
  document.getElementById("emailSummaryBtn").addEventListener("click", sendSummaryByEmail);

  document.querySelectorAll(".navbtn").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.view === "form" && formIsDirty) {
      if (!confirm("Esto abrirá un registro nuevo y en blanco. Lo que no hayas guardado de este se perderá. ¿Continuar?")) return;
    }
    if (b.dataset.view === "form") newRecord();
    switchView(b.dataset.view);
  }));
  document.getElementById("historySearch").addEventListener("input", renderHistory);
  document.getElementById("exportAllBtn").addEventListener("click", exportAll);
  document.getElementById("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importAll(e.target.files[0]);
  });

  newRecord();
  renderHistory();
});

/* ================================ PWA: service worker ================================ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

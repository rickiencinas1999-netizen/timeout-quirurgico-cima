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
    { id: "profilaxisV2", label: "Profilaxis antibiótica administrada." },
    { id: "esterilizacionVerificada", label: "Verificación de indicadores de esterilización.", flagOn: "no" },
  ],
  v3: [
    { id: "procedimientoConfirmado", label: "Se confirma procedimiento realizado.", flagOn: "no" },
    { id: "conteoCompleto", label: "Cuenta de instrumental, textil y agujas completa.", flagOn: "no", critical: true },
    { id: "patologiaEtiquetada", label: "Pieza de patología etiquetada y en solución conservadora." },
    { id: "problemasMaterial", label: "¿Existen problemas que reportar (material/equipo)?", flagOn: "si" },
  ],
};

const STEP_COUNT = 6;

/* ------------------------------- Estado --------------------------------- */
let currentStep = 0;
let editingId = null; // id del registro en edición (si viene del historial)

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
const IMPLANT_FIELDS = ["dispositivo", "fabricante", "modelo", "lote", "serie", "caducidad", "sitio", "cantidad"];

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
function collectPhaseAnswers(phase) {
  const answers = {};
  document.querySelectorAll(`.checklist[data-phase="${phase}"] .item`).forEach((item) => {
    const id = item.dataset.item;
    const answerEl = item.querySelector(".item__answer");
    const value = answerEl ? answerEl.dataset.value || null : null;
    const detailEl = item.querySelector(`[data-detail-for="${id}"]`);
    answers[id] = { value, detalle: detailEl ? detailEl.value.trim() : "" };
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

  const phaseHtml = (phase, title) => `
    <div class="summary-block">
      <h3>${title}</h3>
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

  let implantHtml = "";
  if (record.implantes.usa && record.implantes.dispositivos.length) {
    implantHtml = `
      <div class="summary-block">
        <h3>Dispositivos médicos implantados</h3>
        <ul class="summary-list">
          ${record.implantes.dispositivos.map((d) => `<li><span>${escapeHtml(d.dispositivo || "(sin nombre)")} — ${escapeHtml(d.fabricante || "")}</span><b>Lote ${escapeHtml(d.lote || "—")} · Serie ${escapeHtml(d.serie || "—")}</b></li>`).join("")}
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
    ${phaseHtml("v2", "2ª Verificación — Pausa quirúrgica")}
    ${phaseHtml("v3", "3ª Verificación — Antes de salir de sala")}
    ${implantHtml}
  `;
  window.__lastComputedRecord = record;
  window.__lastComputedAlerts = alerts;
  window.__lastComputedComplete = allComplete;
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
      const detailEl = item.querySelector(`[data-detail-for="${id}"]`);
      if (detailEl) detailEl.value = ans.detalle || "";
    });
    form[`${phase}_verificadoPor`].value = record[phase].verificadoPor || "";
    form[`${phase}_hora`].value = record[phase].hora || "";
  });

  document.getElementById("usaLaser").checked = !!record.v2.laser?.usa;
  document.getElementById("laserOptions").hidden = !record.v2.laser?.usa;
  form.laser_epp.checked = !!record.v2.laser?.epp;
  form.laser_senalizacion.checked = !!record.v2.laser?.senalizacion;
  form.laser_ventana.checked = !!record.v2.laser?.ventana;

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
        <td>${escapeHtml(r.general.fecha || "—")}</td>
        <td>${escapeHtml(r.general.paciente || "—")}</td>
        <td>${escapeHtml(r.general.expediente || "—")}</td>
        <td>${escapeHtml(r.general.cirugia || "—")}</td>
        <td>${estadoBadge}</td>
        <td>${alertBadge}</td>
        <td class="row-actions">
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

  document.querySelectorAll(".navbtn").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  document.getElementById("historySearch").addEventListener("input", renderHistory);
  document.getElementById("exportAllBtn").addEventListener("click", exportAll);
  document.getElementById("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importAll(e.target.files[0]);
  });

  newRecord();
  renderHistory();
});

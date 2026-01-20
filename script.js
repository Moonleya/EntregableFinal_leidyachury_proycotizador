const STORAGE_KEY = "cotizacionesWideTech";

let CONFIG = null; // aquí carga el JSON  (tarifas, precarga, campos)

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("cotizador-form");
  if (!form) return;

  // 1) Cargar JSON remoto 
  try {
    const res = await fetch("data/cotizador-config.json");
    if (!res.ok) throw new Error("No se pudo cargar el JSON");
    CONFIG = await res.json();
  } catch (e) {
    mostrarToast("Error cargando configuración (JSON). Revisa la carpeta data/.", true);
    return;
  }

  // 2) Render HTML desde JS (inputs por sección usando CONFIG.campos)
  renderCamposDinamicos();

  // 3) Precargar datos (requisito)
  aplicarPrecarga();

  // 4) Interactividad: recalcular en vivo (asíncrono)
  activarCalculoEnVivo();

  // 5) Historial
  renderHistorial();

  // 6) Submit: confirm con librería (sin confirm/alert)
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const datos = leerDatosFormulario();
    const costos = calcularCostos(datos);

    // Validación 
    if (!datos.nombreProyecto) {
      mostrarToast("Escribe el nombre del proyecto.", true);
      return;
    }

    const r = await Swal.fire({
      title: "¿Guardar esta cotización?",
      text: `Total estimado: ${formatearMoneda(costos.totalProyecto)}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar"
    });

    if (!r.isConfirmed) return;

    mostrarResultados(costos);
    guardarCotizacion(datos, costos);
    renderHistorial();

    mostrarToast("Cotización guardada correctamente ");
    const mensaje = document.getElementById("mensajeGuardado");
    if (mensaje) {
      mensaje.textContent = "Cotización guardada correctamente.";
      setTimeout(() => (mensaje.textContent = ""), 2500);
    }
  });
});


function renderCamposDinamicos() {
 
  const form = document.getElementById("cotizador-form");
  if (!form || !CONFIG?.campos) return;

 
  const h3Web = [...form.querySelectorAll("h3")].find(h => h.textContent.trim().toLowerCase() === "web");
  const h3App = [...form.querySelectorAll("h3")].find(h => h.textContent.trim().toLowerCase() === "app");
  const h3Hw  = [...form.querySelectorAll("h3")].find(h => h.textContent.trim().toLowerCase() === "hardware");

  
  form.querySelectorAll(".field-row").forEach(el => el.remove());

  // Crear campos por sección
  insertarCamposSeccion(h3Web, "web");
  insertarCamposSeccion(h3App, "app");
  insertarCamposSeccion(h3Hw, "hardware");
}

function insertarCamposSeccion(h3, seccion) {
  if (!h3) return;

  const campos = CONFIG.campos.filter(c => c.seccion === seccion);
  campos.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.className = "field-row";

    const label = document.createElement("label");
    label.setAttribute("for", c.id);
    label.textContent = c.label;

    const input = document.createElement("input");
    input.type = "number";
    input.id = c.id;
    input.min = "0";
    input.value = "0";

    wrap.appendChild(label);
    wrap.appendChild(input);

    h3.insertAdjacentElement("afterend", wrap);
  });
}

// ---------------- Precarga ----------------
function aplicarPrecarga() {
  if (!CONFIG?.precarga) return;

  const p = CONFIG.precarga;

  const nombre = document.getElementById("nombreProyecto");
  if (nombre && !nombre.value) nombre.value = p.nombreProyecto || "";

  const fecha = document.getElementById("fecha");
  if (fecha && !fecha.value) {
    // si no hay fecha, ponemos la de hoy -buena practica
    fecha.value = new Date().toISOString().slice(0, 10);
  }

  // números
  const ids = [
    "webModulosNuevos",
    "webAjustesActuales",
    "appPantallasNuevas",
    "appAjustes",
    "hardwareHomologaciones",
    "hardwareAjustes"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = Number(p[id]);
    if (!Number.isNaN(v)) el.value = String(v);
  });

  // calcular una vez al inicio
  recalcularYMostrar();
}


function activarCalculoEnVivo() {
  const form = document.getElementById("cotizador-form");
  if (!form) return;

  let t = null;
  form.addEventListener("input", () => {
    // simple para que sea “asíncrono” y no recalcular 1000 veces
    clearTimeout(t);
    t = setTimeout(recalcularYMostrar, 120);
  });
}

function recalcularYMostrar() {
  const datos = leerDatosFormulario();
  const costos = calcularCostos(datos);
  mostrarResultados(costos);
}

// ---------------- Lectura de formulario ----------------
function leerDatosFormulario() {
  const getNumber = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    nombreProyecto: (document.getElementById("nombreProyecto")?.value || "").trim(),
    fecha: document.getElementById("fecha")?.value || "",
    webModulosNuevos: getNumber("webModulosNuevos"),
    webAjustesActuales: getNumber("webAjustesActuales"),
    appPantallasNuevas: getNumber("appPantallasNuevas"),
    appAjustes: getNumber("appAjustes"),
    hardwareHomologaciones: getNumber("hardwareHomologaciones"),
    hardwareAjustes: getNumber("hardwareAjustes")
  };
}

// ---------------- Cálculos (con tarifas desde JSON) ----------------
function calcularCostos(d) {
  const t = CONFIG?.tarifas;
  if (!t) return { totalWeb: 0, totalApp: 0, totalHardware: 0, totalProyecto: 0 };

  const totalWeb =
    d.webModulosNuevos * t.web.modulo +
    d.webAjustesActuales * t.web.ajuste;

  const totalApp =
    d.appPantallasNuevas * t.app.pantalla +
    d.appAjustes * t.app.ajuste;

  const totalHardware =
    d.hardwareHomologaciones * t.hardware.homologacion +
    d.hardwareAjustes * t.hardware.ajuste;

  const totalProyecto = totalWeb + totalApp + totalHardware;

  return { totalWeb, totalApp, totalHardware, totalProyecto };
}

// ---------------- DOM (mostrar resultados) ----------------
function formatearMoneda(v) {
  return "$ " + Number(v).toLocaleString("es-CO");
}

function mostrarResultados(c) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatearMoneda(val);
  };

  set("totalWeb", c.totalWeb);
  set("totalApp", c.totalApp);
  set("totalHardware", c.totalHardware);
  set("totalProyecto", c.totalProyecto);
}

// ---------------- LocalStorage + Historial ----------------
function obtenerCotizacionesGuardadas() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function guardarCotizacion(datos, costos) {
  const lista = obtenerCotizacionesGuardadas();
  lista.push({
    id: Date.now(),
    nombreProyecto: datos.nombreProyecto,
    fecha: datos.fecha,
    datos,
    costos
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function renderHistorial() {
  const ul = document.getElementById("historial-list");
  if (!ul) return;

  ul.innerHTML = "";
  const lista = obtenerCotizacionesGuardadas().slice().reverse();

  if (lista.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No hay cotizaciones guardadas aún.";
    ul.appendChild(li);
    return;
  }

  lista.forEach((item) => {
    const li = document.createElement("li");

    const texto = document.createElement("span");
    texto.textContent =
      `${item.fecha || "Sin fecha"} - ${item.nombreProyecto || "Sin nombre"} - ` +
      `Total: ${formatearMoneda(item.costos.totalProyecto)} `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Cargar";
    btn.style.marginLeft = "10px";
    btn.addEventListener("click", () => cargarCotizacionEnFormulario(item));

    li.appendChild(texto);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function cargarCotizacionEnFormulario(item) {
  const d = item?.datos;
  if (!d) return;

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = String(v ?? "");
  };

  setVal("nombreProyecto", d.nombreProyecto);
  setVal("fecha", d.fecha);
  setVal("webModulosNuevos", d.webModulosNuevos);
  setVal("webAjustesActuales", d.webAjustesActuales);
  setVal("appPantallasNuevas", d.appPantallasNuevas);
  setVal("appAjustes", d.appAjustes);
  setVal("hardwareHomologaciones", d.hardwareHomologaciones);
  setVal("hardwareAjustes", d.hardwareAjustes);

  recalcularYMostrar();
  mostrarToast("Cotización cargada en el formulario ✅");
}

// ---------------- Notificaciones (Toastify) ----------------
function mostrarToast(texto, esError = false) {
  if (typeof Toastify !== "function") return;

  Toastify({
    text: texto,
    duration: 2800,
    close: true,
    gravity: "top",
    position: "right",
    stopOnFocus: true,
    style: {
      background: esError ? "#b3261e" : "#298644"
    }
  }).showToast();
}

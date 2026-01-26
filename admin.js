import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZLk6DfCrt0TmWthRTFoN4JNb7x3FBY-Y",
  authDomain: "racsa-rg.firebaseapp.com",
  databaseURL: "https://racsa-rg-default-rtdb.firebaseio.com",
  projectId: "racsa-rg",
  storageBucket: "racsa-rg.firebasestorage.app",
  messagingSenderId: "348973311556",
  appId: "1:348973311556:web:72cf47c70fc1b6bea7be11"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const topSub = document.getElementById("topSub");
const btnVolver = document.getElementById("btnVolver");
const btnLogout = document.getElementById("btnLogout");

const formSucursal = document.getElementById("formSucursal");
const sucId = document.getElementById("sucId");
const sucNombre = document.getElementById("sucNombre");
const sucLat = document.getElementById("sucLat");
const sucLng = document.getElementById("sucLng");
const sucRadio = document.getElementById("sucRadio");
const msgSucursal = document.getElementById("msgSucursal");
const listaSucursales = document.getElementById("listaSucursales");

const btnRefrescarUsuarios = document.getElementById("btnRefrescarUsuarios");
const listaUsuarios = document.getElementById("listaUsuarios");

const fSucursal = document.getElementById("fSucursal");
const fUsuario = document.getElementById("fUsuario");
const fEstado = document.getElementById("fEstado");
const fFecha = document.getElementById("fFecha");
const btnRefrescarJornadas = document.getElementById("btnRefrescarJornadas");
const listaJornadas = document.getElementById("listaJornadas");

const stTotal = document.getElementById("stTotal");
const stMin = document.getElementById("stMin");
const stHoras = document.getElementById("stHoras");

let currentUser = null;
let perfil = null;

let cacheUsuarios = {};
let cacheSucursales = {};

function setMsg(text, type = "") {
  msgSucursal.textContent = text;
  msgSucursal.className = "msg " + type;
}

function irLogin() {
  window.location.href = "index.html";
}

function irPanel() {
  window.location.href = "panel.html";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function hora(ts) {
  if (!ts) return "---";
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function minutosAHoras(min) {
  if (!Number.isFinite(min) || min < 0) return "---";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

async function getPerfil(uid) {
  const snap = await get(ref(db, `usuarios/${uid}`));
  if (!snap.exists()) return null;
  return snap.val();
}

function safeId(str) {
  return str.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

async function guardarSucursal() {
  setMsg("");

  const id = safeId(sucId.value);
  const nombre = sucNombre.value.trim();
  const lat = Number(sucLat.value);
  const lng = Number(sucLng.value);
  const radio = Number(sucRadio.value);

  if (!id) { setMsg("Escribe un ID válido.", "err"); return; }
  if (!nombre) { setMsg("Escribe el nombre.", "err"); return; }
  if (!Number.isFinite(lat)) { setMsg("Latitud inválida.", "err"); return; }
  if (!Number.isFinite(lng)) { setMsg("Longitud inválida.", "err"); return; }
  if (!Number.isFinite(radio) || radio < 10) { setMsg("Radio inválido.", "err"); return; }

  const data = { nombre, lat, lng, radio_m: radio };

  await set(ref(db, `sucursales/${id}`), data);

  setMsg("Sucursal guardada.", "ok");
  sucId.value = "";
  sucNombre.value = "";
  sucLat.value = "";
  sucLng.value = "";
  sucRadio.value = "";

  await cargarSucursales();
  await cargarFiltros();
}

async function cargarSucursales() {
  const snap = await get(ref(db, "sucursales"));
  cacheSucursales = snap.exists() ? snap.val() : {};

  const ids = Object.keys(cacheSucursales || {});
  if (!ids.length) {
    listaSucursales.innerHTML = `<div class="muted">No hay sucursales.</div>`;
    return;
  }

  const items = ids.map(id => {
    const s = cacheSucursales[id] || {};
    return {
      id,
      nombre: s.nombre || id,
      lat: s.lat,
      lng: s.lng,
      radio_m: s.radio_m
    };
  });

  items.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  listaSucursales.innerHTML = items.map(s => `
    <div class="item">
      <div class="item-top">
        <div class="item-title">${s.nombre}</div>
        <button class="btn-mini danger" data-del-sucursal="${s.id}">Eliminar</button>
      </div>
      <div class="item-sub">ID: ${s.id}</div>
      <div class="item-sub">Lat: ${s.lat} · Lng: ${s.lng} · Radio: ${s.radio_m}m</div>
    </div>
  `).join("");

  document.querySelectorAll("[data-del-sucursal]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-sucursal");
      const ok = confirm("¿Eliminar sucursal? Esto no borra jornadas.");
      if (!ok) return;
      await remove(ref(db, `sucursales/${id}`));
      await cargarSucursales();
      await cargarFiltros();
      await cargarJornadas();
    });
  });
}

async function cargarUsuarios() {
  listaUsuarios.innerHTML = `<div class="muted">Cargando...</div>`;

  const snap = await get(ref(db, "usuarios"));
  cacheUsuarios = snap.exists() ? snap.val() : {};

  const ids = Object.keys(cacheUsuarios || {});
  if (!ids.length) {
    listaUsuarios.innerHTML = `<div class="muted">No hay usuarios.</div>`;
    return;
  }

  const sucKeys = Object.keys(cacheSucursales || {});
  const sucOptions = [`<option value="">Sin sucursal</option>`]
    .concat(sucKeys.map(k => `<option value="${k}">${cacheSucursales[k]?.nombre || k}</option>`))
    .join("");

  const items = ids.map(uid => {
    const u = cacheUsuarios[uid] || {};
    return {
      uid,
      nombre: u.nombre || "Sin nombre",
      rol: u.rol || "empleado",
      sucursalId: u.sucursalId || "",
      activo: u.activo !== false
    };
  });

  items.sort((a, b) => a.nombre.localeCompare(b.nombre));

  listaUsuarios.innerHTML = items.map(u => `
    <div class="item">
      <div class="item-top">
        <div class="item-title">${u.nombre}</div>
        <button class="btn-mini ${u.activo ? "danger" : ""}" data-toggle="${u.uid}">
          ${u.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
      <div class="item-sub">UID: ${u.uid}</div>

      <div class="row">
        <select class="select" data-rol="${u.uid}">
          <option value="admin" ${u.rol === "admin" ? "selected" : ""}>admin</option>
          <option value="encargado" ${u.rol === "encargado" ? "selected" : ""}>encargado</option>
          <option value="empleado" ${u.rol === "empleado" ? "selected" : ""}>empleado</option>
        </select>

        <select class="select" data-sucursal="${u.uid}">
          ${sucOptions}
        </select>

        <button class="btn-mini" data-save="${u.uid}">Guardar</button>
      </div>
    </div>
  `).join("");

  items.forEach(u => {
    const selSuc = document.querySelector(`[data-sucursal="${u.uid}"]`);
    if (selSuc) selSuc.value = u.sucursalId || "";
  });

  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-save");
      const rolSel = document.querySelector(`[data-rol="${uid}"]`);
      const sucSel = document.querySelector(`[data-sucursal="${uid}"]`);

      const newRol = rolSel.value;
      const newSuc = sucSel.value;

      await update(ref(db, `usuarios/${uid}`), { rol: newRol, sucursalId: newSuc });
      alert("Usuario actualizado");
      await cargarFiltros();
      await cargarJornadas();
    });
  });

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-toggle");
      const ok = confirm("¿Cambiar estado del usuario?");
      if (!ok) return;

      const snapU = await get(ref(db, `usuarios/${uid}`));
      if (!snapU.exists()) return;

      const activo = snapU.val()?.activo !== false;
      await update(ref(db, `usuarios/${uid}`), { activo: !activo });

      await cargarUsuarios();
      await cargarFiltros();
      await cargarJornadas();
    });
  });
}

async function cargarFiltros() {
  const sucKeys = Object.keys(cacheSucursales || {});
  const userKeys = Object.keys(cacheUsuarios || {});

  const sucVal = fSucursal.value;
  const userVal = fUsuario.value;

  fSucursal.innerHTML = `<option value="">Todas</option>` + sucKeys
    .map(k => `<option value="${k}">${cacheSucursales[k]?.nombre || k}</option>`)
    .join("");

  fUsuario.innerHTML = `<option value="">Todos</option>` + userKeys
    .map(uid => `<option value="${uid}">${cacheUsuarios[uid]?.nombre || uid}</option>`)
    .join("");

  fSucursal.value = sucKeys.includes(sucVal) ? sucVal : "";
  fUsuario.value = userKeys.includes(userVal) ? userVal : "";
}

function calcularMinutos(j) {
  if (Number.isFinite(j?.minutos)) return j.minutos;
  if (j?.entradaTs && j?.salidaTs) return Math.max(0, Math.round((j.salidaTs - j.entradaTs) / 60000));
  return null;
}

function renderJornadas(arr) {
  if (!arr.length) {
    listaJornadas.innerHTML = `<div class="muted">No hay jornadas con esos filtros.</div>`;
    stTotal.textContent = "0";
    stMin.textContent = "0";
    stHoras.textContent = "0";
    return;
  }

  let totalMin = 0;
  arr.forEach(x => {
    const m = calcularMinutos(x);
    if (Number.isFinite(m)) totalMin += m;
  });

  stTotal.textContent = String(arr.length);
  stMin.textContent = String(totalMin);
  stHoras.textContent = minutosAHoras(totalMin);

  listaJornadas.innerHTML = arr.map(j => {
    const estadoClass = j.estado === "cerrada" ? "pill pill-closed" : "pill pill-open";
    const estadoTxt = j.estado === "cerrada" ? "Cerrada" : "Abierta";
    const entrada = j.entradaTs ? hora(j.entradaTs) : "---";
    const salida = j.salidaTs ? hora(j.salidaTs) : "---";
    const mins = calcularMinutos(j);

    return `
      <div class="item">
        <div class="item-top">
          <div class="item-title">${j.fechaKey} · ${j.nombre || "Usuario"}</div>
          <div class="${estadoClass}">${estadoTxt}</div>
        </div>
        <div class="item-sub">${j.sucursalNombre || ""}</div>
        <div class="item-sub">Entrada: ${entrada} · Salida: ${salida}</div>
        <div class="item-sub">Tiempo: ${mins === null ? "---" : minutosAHoras(mins)}</div>
      </div>
    `;
  }).join("");
}

async function cargarJornadas() {
  listaJornadas.innerHTML = `<div class="muted">Cargando...</div>`;

  const snap = await get(ref(db, "jornadas"));
  if (!snap.exists()) {
    renderJornadas([]);
    return;
  }

  const data = snap.val();
  const uids = Object.keys(data);

  let arr = [];

  uids.forEach(uid => {
    const porFecha = data[uid] || {};
    const fechas = Object.keys(porFecha);

    fechas.forEach(fk => {
      const j = porFecha[fk] || {};
      arr.push({
        ...j,
        uid,
        fechaKey: fk
      });
    });
  });

  arr.sort((a, b) => (b.fechaKey || "").localeCompare(a.fechaKey || ""));

  const sId = fSucursal.value.trim();
  const uId = fUsuario.value.trim();
  const est = fEstado.value.trim();
  const fecha = fFecha.value.trim();

  if (sId) arr = arr.filter(x => (x.sucursalId || "") === sId);
  if (uId) arr = arr.filter(x => (x.uid || "") === uId);
  if (est) arr = arr.filter(x => (x.estado || "") === est);
  if (fecha) arr = arr.filter(x => (x.fechaKey || "") === fecha);

  arr = arr.slice(0, 80);

  renderJornadas(arr);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    irLogin();
    return;
  }

  currentUser = user;

  perfil = await getPerfil(user.uid);
  if (!perfil || perfil.rol !== "admin") {
    irPanel();
    return;
  }

  topSub.textContent = `${perfil.nombre || "Admin"} · admin`;

  await cargarSucursales();
  await cargarUsuarios();
  await cargarFiltros();
  await cargarJornadas();
});

formSucursal.addEventListener("submit", async (e) => {
  e.preventDefault();
  await guardarSucursal();
});

btnRefrescarUsuarios.addEventListener("click", async () => {
  await cargarSucursales();
  await cargarUsuarios();
  await cargarFiltros();
  await cargarJornadas();
});

btnRefrescarJornadas.addEventListener("click", cargarJornadas);

fSucursal.addEventListener("change", cargarJornadas);
fUsuario.addEventListener("change", cargarJornadas);
fEstado.addEventListener("change", cargarJornadas);

btnVolver.addEventListener("click", () => {
  irPanel();
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  irLogin();
});
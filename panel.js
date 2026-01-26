import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
const btnLogout = document.getElementById("btnLogout");

const txtEstado = document.getElementById("txtEstado");
const txtSucursal = document.getElementById("txtSucursal");
const txtDistancia = document.getElementById("txtDistancia");
const txtAcceso = document.getElementById("txtAcceso");
const txtPrecision = document.getElementById("txtPrecision");
const msgRegistro = document.getElementById("msgRegistro");

const txtEntradaHoy = document.getElementById("txtEntradaHoy");
const txtSalidaHoy = document.getElementById("txtSalidaHoy");
const txtTiempoHoy = document.getElementById("txtTiempoHoy");

const btnUbicacion = document.getElementById("btnUbicacion");
const btnEntrada = document.getElementById("btnEntrada");
const btnSalida = document.getElementById("btnSalida");

const mapFrame = document.getElementById("mapFrame");

const historialList = document.getElementById("historialList");
const btnRefrescarHistorial = document.getElementById("btnRefrescarHistorial");

const cfgNombre = document.getElementById("cfgNombre");
const cfgRol = document.getElementById("cfgRol");
const cfgSucursal = document.getElementById("cfgSucursal");
const cfgCorreo = document.getElementById("cfgCorreo");
const adminBox = document.getElementById("adminBox");
const btnIrAdmin = document.getElementById("btnIrAdmin");

let currentUser = null;
let perfil = null;
let sucursal = null;
let ubicacionUsuario = null;
let jornadaHoy = null;

function setMsg(text, type = "") {
  msgRegistro.textContent = text;
  msgRegistro.className = "msg " + type;
}

function irLogin() {
  window.location.href = "index.html";
}

function irPerfil() {
  window.location.href = "perfil.html";
}

function setBadgeOk() {
  txtAcceso.textContent = "Permitido";
  txtAcceso.className = "badge badge-ok";
}

function setBadgeNo(text) {
  txtAcceso.textContent = text;
  txtAcceso.className = "badge badge-no";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function keyHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getPerfil(uid) {
  const snap = await get(ref(db, `usuarios/${uid}`));
  if (!snap.exists()) return null;
  return snap.val();
}

async function getSucursalById(id) {
  const snap = await get(ref(db, `sucursales/${id}`));
  if (!snap.exists()) return null;
  return snap.val();
}

async function getJornada(uid, fechaKey) {
  const snap = await get(ref(db, `jornadas/${uid}/${fechaKey}`));
  if (!snap.exists()) return null;
  return snap.val();
}

function setMap(lat, lng) {
  const url = `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
  mapFrame.src = url;
}

function evaluarAcceso() {
  if (!ubicacionUsuario) {
    txtDistancia.textContent = "---";
    txtPrecision.textContent = "---";
    setBadgeNo("Bloqueado");
    return false;
  }

  if (!sucursal || !sucursal.lat || !sucursal.lng || !sucursal.radio_m) {
    txtDistancia.textContent = "---";
    setBadgeNo("Sin sucursal");
    return false;
  }

  const d = distanciaMetros(
    ubicacionUsuario.lat,
    ubicacionUsuario.lng,
    sucursal.lat,
    sucursal.lng
  );

  txtDistancia.textContent = `${Math.round(d)} m`;
  txtPrecision.textContent = `±${Math.round(ubicacionUsuario.accuracy)} m`;

  if (d <= Number(sucursal.radio_m)) {
    setBadgeOk();
    return true;
  } else {
    setBadgeNo("Fuera");
    return false;
  }
}

function obtenerUbicacion() {
  setMsg("");

  if (!navigator.geolocation) {
    setMsg("Tu navegador no soporta geolocalización.", "err");
    return;
  }

  txtEstado.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ubicacionUsuario = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };

      setMap(ubicacionUsuario.lat, ubicacionUsuario.lng);
      txtEstado.textContent = "Ubicación actualizada";
      evaluarAcceso();
    },
    () => {
      setMsg("No se pudo obtener tu ubicación. Activa GPS y permisos.", "err");
      txtEstado.textContent = "Ubicación no disponible";
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    }
  );
}

function pintarJornadaHoy() {
  txtEntradaHoy.textContent = jornadaHoy?.entradaTs ? hora(jornadaHoy.entradaTs) : "---";
  txtSalidaHoy.textContent = jornadaHoy?.salidaTs ? hora(jornadaHoy.salidaTs) : "---";

  if (jornadaHoy?.entradaTs && jornadaHoy?.salidaTs) {
    const min = Math.max(0, Math.round((jornadaHoy.salidaTs - jornadaHoy.entradaTs) / 60000));
    txtTiempoHoy.textContent = minutosAHoras(min);
  } else {
    txtTiempoHoy.textContent = "---";
  }

  if (!jornadaHoy?.entradaTs) {
    btnEntrada.disabled = false;
    btnEntrada.style.opacity = "1";
    btnSalida.disabled = true;
    btnSalida.style.opacity = ".55";
    return;
  }

  if (jornadaHoy?.entradaTs && !jornadaHoy?.salidaTs) {
    btnEntrada.disabled = true;
    btnEntrada.style.opacity = ".55";
    btnSalida.disabled = false;
    btnSalida.style.opacity = "1";
    return;
  }

  if (jornadaHoy?.entradaTs && jornadaHoy?.salidaTs) {
    btnEntrada.disabled = true;
    btnEntrada.style.opacity = ".55";
    btnSalida.disabled = true;
    btnSalida.style.opacity = ".55";
  }
}

async function cargarJornadaHoy() {
  if (!currentUser) return;
  jornadaHoy = await getJornada(currentUser.uid, keyHoy());
  pintarJornadaHoy();
}

async function registrarEntrada() {
  setMsg("");

  if (!currentUser || !perfil) {
    setMsg("Sesión inválida.", "err");
    irLogin();
    return;
  }

  if (!sucursal) {
    setMsg("No tienes sucursal asignada.", "err");
    return;
  }

  const ok = evaluarAcceso();
  if (!ok) {
    setMsg("No puedes registrar fuera de la sucursal.", "err");
    return;
  }

  await cargarJornadaHoy();

  if (jornadaHoy?.entradaTs) {
    setMsg("Ya registraste tu entrada hoy.", "err");
    return;
  }

  const now = Date.now();
  const fechaKey = keyHoy();

  const data = {
    uid: currentUser.uid,
    nombre: perfil.nombre || "",
    rol: perfil.rol || "",
    sucursalId: perfil.sucursalId || "",
    sucursalNombre: sucursal.nombre || "",
    entradaTs: now,
    salidaTs: null,
    estado: "abierta",
    entradaLat: ubicacionUsuario.lat,
    entradaLng: ubicacionUsuario.lng,
    salidaLat: null,
    salidaLng: null,
    minutos: null
  };

  await set(ref(db, `jornadas/${currentUser.uid}/${fechaKey}`), data);

  setMsg("Entrada registrada.", "ok");
  await cargarJornadaHoy();
}

async function registrarSalida() {
  setMsg("");

  if (!currentUser || !perfil) {
    setMsg("Sesión inválida.", "err");
    irLogin();
    return;
  }

  if (!sucursal) {
    setMsg("No tienes sucursal asignada.", "err");
    return;
  }

  const ok = evaluarAcceso();
  if (!ok) {
    setMsg("No puedes registrar fuera de la sucursal.", "err");
    return;
  }

  await cargarJornadaHoy();

  if (!jornadaHoy?.entradaTs) {
    setMsg("Primero registra tu entrada.", "err");
    return;
  }

  if (jornadaHoy?.salidaTs) {
    setMsg("Ya registraste tu salida hoy.", "err");
    return;
  }

  const now = Date.now();
  const min = Math.max(0, Math.round((now - jornadaHoy.entradaTs) / 60000));
  const fechaKey = keyHoy();

  await update(ref(db, `jornadas/${currentUser.uid}/${fechaKey}`), {
    salidaTs: now,
    salidaLat: ubicacionUsuario.lat,
    salidaLng: ubicacionUsuario.lng,
    minutos: min,
    estado: "cerrada"
  });

  setMsg("Salida registrada.", "ok");
  await cargarJornadaHoy();
}

function renderHistorial(items) {
  if (!items.length) {
    historialList.innerHTML = `<div class="muted">Sin jornadas aún.</div>`;
    return;
  }

  historialList.innerHTML = items.map(x => {
    const estadoClass = x.estado === "cerrada" ? "pill pill-closed" : "pill pill-open";
    const estadoTxt = x.estado === "cerrada" ? "Cerrada" : "Abierta";
    const entrada = x.entradaTs ? hora(x.entradaTs) : "---";
    const salida = x.salidaTs ? hora(x.salidaTs) : "---";
    const mins = (x.entradaTs && x.salidaTs) ? Math.max(0, Math.round((x.salidaTs - x.entradaTs) / 60000)) : null;

    return `
      <div class="item">
        <div class="item-top">
          <div class="item-title">${x.fechaKey || ""} · ${x.sucursalNombre || ""}</div>
          <div class="${estadoClass}">${estadoTxt}</div>
        </div>
        <div class="item-sub">Entrada: ${entrada} · Salida: ${salida}</div>
        <div class="item-sub">Tiempo: ${mins === null ? "---" : minutosAHoras(mins)}</div>
      </div>
    `;
  }).join("");
}

async function cargarHistorial() {
  if (!currentUser) return;

  historialList.innerHTML = `<div class="muted">Cargando...</div>`;

  const snap = await get(ref(db, `jornadas/${currentUser.uid}`));
  if (!snap.exists()) {
    renderHistorial([]);
    return;
  }

  const data = snap.val();
  const keys = Object.keys(data);

  const arr = keys.map(k => {
    const j = data[k] || {};
    return {
      ...j,
      fechaKey: k
    };
  });

  arr.sort((a, b) => (b.fechaKey || "").localeCompare(a.fechaKey || ""));
  renderHistorial(arr.slice(0, 30));
}

function activarTabs() {
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");

  tabs.forEach(t => {
    t.addEventListener("click", async () => {
      tabs.forEach(x => x.classList.remove("active"));
      t.classList.add("active");

      const id = t.dataset.view;
      views.forEach(v => v.classList.remove("active"));
      document.getElementById(id).classList.add("active");

      if (id === "viewHistorial") await cargarHistorial();
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    irLogin();
    return;
  }

  currentUser = user;

  perfil = await getPerfil(user.uid);
  if (!perfil) {
    irPerfil();
    return;
  }

  if (perfil.activo === false) {
    await signOut(auth);
    irLogin();
    return;
  }

  if (!perfil.rol) {
    irLogin();
    return;
  }

  topSub.textContent = `${perfil.nombre || "Usuario"} · ${perfil.rol || "sin rol"}`;

  cfgNombre.textContent = perfil.nombre || "---";
  cfgRol.textContent = perfil.rol || "---";
  cfgCorreo.textContent = user.email || "---";

  if (perfil.sucursalId) {
    sucursal = await getSucursalById(perfil.sucursalId);
  }

  txtSucursal.textContent = sucursal?.nombre || "No asignada";
  cfgSucursal.textContent = sucursal?.nombre || "No asignada";

  if (perfil.rol === "admin") {
    adminBox.classList.remove("hidden");
  } else {
    adminBox.classList.add("hidden");
  }

  const letra = (perfil.nombre || "R").trim().charAt(0).toUpperCase();
  document.querySelector(".avatar").textContent = letra;

  setMap(sucursal?.lat || 20.6736, sucursal?.lng || -103.344);
  activarTabs();
  await cargarJornadaHoy();
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  irLogin();
});

btnUbicacion.addEventListener("click", obtenerUbicacion);
btnEntrada.addEventListener("click", registrarEntrada);
btnSalida.addEventListener("click", registrarSalida);

btnRefrescarHistorial.addEventListener("click", cargarHistorial);

btnIrAdmin.addEventListener("click", () => {
  window.location.href = "admin.html";
});
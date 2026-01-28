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

const historialList = document.getElementById("historialList");
const btnRefrescarHistorial = document.getElementById("btnRefrescarHistorial");

const cfgNombre = document.getElementById("cfgNombre");
const cfgRol = document.getElementById("cfgRol");
const cfgSucursal = document.getElementById("cfgSucursal");
const cfgCorreo = document.getElementById("cfgCorreo");
const adminBox = document.getElementById("adminBox");
const btnIrAdmin = document.getElementById("btnIrAdmin");

const mapDiv = document.getElementById("map");

let currentUser = null;
let perfil = null;
let sucursal = null;
let ubicacionUsuario = null;
let jornadaHoy = null;

let map = null;
let markerUsuario = null;
let circleUsuario = null;
let markersSucursales = [];

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

function initMap(lat, lng) {
  if (map) return;

  map = L.map(mapDiv).setView([lat, lng], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);
}

async function cargarSucursalesMapa() {
  if (!map) return;

  markersSucursales.forEach(m => map.removeLayer(m));
  markersSucursales = [];

  const snap = await get(ref(db, "sucursales"));
  if (!snap.exists()) return;

  const iconSucursal = L.icon({
    iconUrl: "imagenes/icono1.png",
    iconSize: [36, 36],
    iconAnchor: [18, 36]
  });

  Object.values(snap.val()).forEach(s => {
    if (!s.lat || !s.lng) return;

    const m = L.marker([s.lat, s.lng], { icon: iconSucursal })
      .addTo(map)
      .bindPopup(s.nombre || "Sucursal");

    markersSucursales.push(m);
  });
}

function pintarUsuarioMapa() {
  if (!map || !ubicacionUsuario) return;

  if (markerUsuario) map.removeLayer(markerUsuario);
  if (circleUsuario) map.removeLayer(circleUsuario);

  markerUsuario = L.circleMarker(
    [ubicacionUsuario.lat, ubicacionUsuario.lng],
    {
      radius: 7,
      color: "#1e88e5",
      fillColor: "#2196f3",
      fillOpacity: 1
    }
  ).addTo(map);

  circleUsuario = L.circle(
    [ubicacionUsuario.lat, ubicacionUsuario.lng],
    {
      radius: ubicacionUsuario.accuracy,
      color: "#1e88e5",
      fillColor: "#1e88e5",
      fillOpacity: 0.15
    }
  ).addTo(map);
}

function setMap(lat, lng) {
  initMap(lat, lng);
  map.setView([lat, lng], 16);
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

  txtEstado.textContent = "Obteniendo ubicación...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ubicacionUsuario = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };

      setMap(ubicacionUsuario.lat, ubicacionUsuario.lng);
      pintarUsuarioMapa();
      evaluarAcceso();
      txtEstado.textContent = "Ubicación actualizada";
    },
    () => {
      setMsg("No se pudo obtener tu ubicación.", "err");
    },
    { enableHighAccuracy: true }
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

  btnEntrada.disabled = !!jornadaHoy?.entradaTs;
  btnSalida.disabled = !jornadaHoy?.entradaTs || !!jornadaHoy?.salidaTs;
}

async function cargarJornadaHoy() {
  if (!currentUser) return;
  jornadaHoy = await getJornada(currentUser.uid, keyHoy());
  pintarJornadaHoy();
}

async function registrarEntrada() {
  if (!evaluarAcceso()) return;

  const fechaKey = keyHoy();
  const now = Date.now();

  const data = {
    uid: currentUser.uid,
    nombre: perfil.nombre,
    rol: perfil.rol,
    sucursalId: perfil.sucursalId,
    sucursalNombre: sucursal?.nombre || "",
    entradaTs: now,
    salidaTs: null,
    estado: "abierta",
    entradaLat: ubicacionUsuario.lat,
    entradaLng: ubicacionUsuario.lng
  };

  await set(ref(db, `jornadas/${currentUser.uid}/${fechaKey}`), data);
  await cargarJornadaHoy();
}

async function registrarSalida() {
  if (!evaluarAcceso() || !jornadaHoy?.entradaTs) return;

  const now = Date.now();
  const min = Math.max(0, Math.round((now - jornadaHoy.entradaTs) / 60000));

  await update(ref(db, `jornadas/${currentUser.uid}/${keyHoy()}`), {
    salidaTs: now,
    minutos: min,
    estado: "cerrada"
  });

  await cargarJornadaHoy();
}

function renderHistorial(items) {
  if (!items.length) {
    historialList.innerHTML = `<div class="muted">Sin jornadas aún.</div>`;
    return;
  }

  historialList.innerHTML = items.map(x => `
    <div class="item">
      <div class="item-top">
        <div class="item-title">${x.fechaKey} · ${x.sucursalNombre || ""}</div>
        <div class="pill ${x.estado === "cerrada" ? "pill-closed" : "pill-open"}">${x.estado}</div>
      </div>
      <div class="item-sub">Entrada: ${hora(x.entradaTs)} · Salida: ${hora(x.salidaTs)}</div>
      <div class="item-sub">Tiempo: ${minutosAHoras(x.minutos)}</div>
    </div>
  `).join("");
}

async function cargarHistorial() {
  const snap = await get(ref(db, `jornadas/${currentUser.uid}`));
  if (!snap.exists()) {
    renderHistorial([]);
    return;
  }

  const arr = Object.entries(snap.val()).map(([k, v]) => ({ ...v, fechaKey: k }));
  arr.sort((a, b) => b.fechaKey.localeCompare(a.fechaKey));
  renderHistorial(arr.slice(0, 30));
}

function activarTabs() {
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", async () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");

      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById(t.dataset.view).classList.add("active");

      if (t.dataset.view === "viewHistorial") await cargarHistorial();
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
  if (!perfil) return irPerfil();

  if (perfil.activo === false) {
    await signOut(auth);
    return irLogin();
  }

  if (perfil.sucursalId) sucursal = await getSucursalById(perfil.sucursalId);

  topSub.textContent = `${perfil.nombre} · ${perfil.rol}`;
  cfgNombre.textContent = perfil.nombre;
  cfgRol.textContent = perfil.rol;
  cfgCorreo.textContent = user.email;
  cfgSucursal.textContent = sucursal?.nombre || "No asignada";
  txtSucursal.textContent = sucursal?.nombre || "No asignada";

  if (perfil.rol === "admin") adminBox.classList.remove("hidden");

  setMap(sucursal?.lat || 20.6736, sucursal?.lng || -103.344);
  await cargarSucursalesMapa();
  activarTabs();
  await cargarJornadaHoy();
});

btnLogout.onclick = async () => {
  await signOut(auth);
  irLogin();
};

btnUbicacion.onclick = obtenerUbicacion;
btnEntrada.onclick = registrarEntrada;
btnSalida.onclick = registrarSalida;
btnRefrescarHistorial.onclick = cargarHistorial;
btnIrAdmin.onclick = () => location.href = "admin.html";
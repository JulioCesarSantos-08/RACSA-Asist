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
const mapDiv = document.getElementById("map");

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

let map = null;
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

  map = L.map(mapDiv).setView([lat, lng], 15);

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
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });

  Object.values(snap.val()).forEach(s => {
    if (!s.lat || !s.lng) return;

    const marker = L.marker([s.lat, s.lng], { icon: iconSucursal })
      .addTo(map)
      .bindPopup(`<strong>${s.nombre || "Sucursal"}</strong>`);

    markersSucursales.push(marker);
  });
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

  topSub.textContent = `${perfil.nombre || "Usuario"} · ${perfil.rol || ""}`;
  cfgNombre.textContent = perfil.nombre || "---";
  cfgRol.textContent = perfil.rol || "---";
  cfgCorreo.textContent = user.email || "---";

  if (perfil.sucursalId) {
    sucursal = await getSucursalById(perfil.sucursalId);
  }

  txtSucursal.textContent = sucursal?.nombre || "No asignada";
  cfgSucursal.textContent = sucursal?.nombre || "No asignada";

  if (perfil.rol === "admin") adminBox.classList.remove("hidden");
  else adminBox.classList.add("hidden");

  const letra = (perfil.nombre || "R").trim().charAt(0).toUpperCase();
  document.querySelector(".avatar").textContent = letra;

  setMap(sucursal?.lat || 20.6736, sucursal?.lng || -103.344);
  await cargarSucursalesMapa();
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
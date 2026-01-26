import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const formPerfil = document.getElementById("formPerfil");
const nombre = document.getElementById("nombre");
const sucursalId = document.getElementById("sucursalId");
const btnGuardar = document.getElementById("btnGuardar");
const btnSalir = document.getElementById("btnSalir");
const msg = document.getElementById("msg");

let currentUser = null;

function setMsg(text, type = "") {
  msg.textContent = text;
  msg.className = "msg " + type;
}

function irLogin() {
  window.location.href = "index.html";
}

function irPanel() {
  window.location.href = "panel.html";
}

async function cargarSucursales() {
  const snap = await get(ref(db, "sucursales"));
  if (!snap.exists()) {
    sucursalId.innerHTML = `<option value="">No hay sucursales</option>`;
    return;
  }

  const data = snap.val();
  const keys = Object.keys(data);

  if (!keys.length) {
    sucursalId.innerHTML = `<option value="">No hay sucursales</option>`;
    return;
  }

  sucursalId.innerHTML = `<option value="">Selecciona una sucursal...</option>`;

  keys.forEach((k) => {
    const s = data[k];
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = s?.nombre ? s.nombre : k;
    sucursalId.appendChild(opt);
  });
}

async function guardarPerfil() {
  setMsg("");

  const n = nombre.value.trim();
  const sId = sucursalId.value.trim();

  if (!n) {
    setMsg("Escribe tu nombre completo.", "err");
    return;
  }

  if (!sId) {
    setMsg("Selecciona tu sucursal.", "err");
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.style.opacity = ".7";

  try {
    const perfilRef = ref(db, `usuarios/${currentUser.uid}`);
    const snap = await get(perfilRef);

    let rol = "empleado";
    if (snap.exists() && snap.val()?.rol) rol = snap.val().rol;

    const data = {
      nombre: n,
      rol: rol,
      sucursalId: sId,
      activo: true
    };

    await set(perfilRef, data);

    localStorage.setItem("racsa_uid", currentUser.uid);
    localStorage.setItem("racsa_rol", rol);

    setMsg("Perfil guardado. Entrando...", "ok");
    setTimeout(() => irPanel(), 600);
  } catch (e) {
    setMsg("No se pudo guardar tu perfil.", "err");
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.style.opacity = "1";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    irLogin();
    return;
  }

  currentUser = user;
  await cargarSucursales();

  const snap = await get(ref(db, `usuarios/${user.uid}`));
  if (snap.exists() && snap.val()?.nombre && snap.val()?.sucursalId) {
    irPanel();
  }
});

formPerfil.addEventListener("submit", async (e) => {
  e.preventDefault();
  await guardarPerfil();
});

btnSalir.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.clear();
  irLogin();
});
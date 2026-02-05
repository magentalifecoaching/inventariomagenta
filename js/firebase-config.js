// 1. Importamos las herramientas de Firebase (Base de datos y Autenticación)
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// 2. TU CONFIGURACIÓN (Reemplaza esto con lo que copiaste de la consola)
const firebaseConfig = {
  apiKey: "AIzaSyDnVCQFBPB-CBXaiRhf0a3bxasKxgh4sbk",
  authDomain: "inventario-magenta.firebaseapp.com",
  projectId: "inventario-magenta",
  storageBucket: "inventario-magenta.firebasestorage.app",
  messagingSenderId: "175796794861",
  appId: "1:175796794861:web:335826ea99455b703ca3e4"
};

// 3. Inicializamos la conexión
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 4. Inicializamos la Autenticación
const auth = getAuth(app);
const provider = new GoogleAuthProvider(); // Proveedor de Google

// 5. Exportamos las herramientas para usarlas en app.js
export { db, auth, provider, signInWithPopup, signOut };
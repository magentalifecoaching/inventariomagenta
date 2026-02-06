import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc } from "firebase/firestore";

// --- REFERENCIAS A COLECCIONES ---
const peopleRef = collection(db, "people");
const itemsRef = collection(db, "items");
const areasRef = collection(db, "areas");
const eventsRef = collection(db, "events");
// NUEVA COLECCIÓN PARA ACTIVIDADES
const activitiesRef = collection(db, "activities"); 

// --- LEER TODO (GET) ---
// Esta función baja toda la base de datos al iniciar la app
export async function getDB() {
    try {
        const [pSnap, iSnap, aSnap, eSnap, acSnap] = await Promise.all([
            getDocs(peopleRef),
            getDocs(itemsRef),
            getDocs(areasRef),
            getDocs(eventsRef),
            getDocs(activitiesRef) // Descargar actividades
        ]);

        return {
            people: pSnap.docs.map(d => ({id: d.id, ...d.data()})),
            items: iSnap.docs.map(d => ({id: d.id, ...d.data()})),
            areas: aSnap.docs.map(d => ({id: d.id, ...d.data()})),
            events: eSnap.docs.map(d => ({id: d.id, ...d.data()})),
            activities: acSnap.docs.map(d => ({id: d.id, ...d.data()})) || [] // Array seguro
        };
    } catch (error) {
        console.error("Error cargando DB:", error);
        // Si falla, retornamos arrays vacíos para que la app no explote
        return { people:[], items:[], areas:[], events:[], activities:[] };
    }
}

// --- FUNCIONES DE GUARDADO (SAVE) ---
// Guardan el array completo sobrescribiendo documentos (Estrategia simple para este MVP)

async function saveCollection(collectionRef, dataArray) {
    const promises = dataArray.map(item => setDoc(doc(collectionRef, item.id), item));
    await Promise.all(promises);
}

export async function savePeople(data) { await saveCollection(peopleRef, data); }
export async function saveItems(data) { await saveCollection(itemsRef, data); }
export async function saveAreas(data) { await saveCollection(areasRef, data); }
export async function saveEvents(data) { await saveCollection(eventsRef, data); }

// NUEVA FUNCIÓN DE GUARDADO
export async function saveActivities(data) { await saveCollection(activitiesRef, data); }
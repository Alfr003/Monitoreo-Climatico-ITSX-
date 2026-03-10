// ========== 1. Mapa Interactivo ==========
// Crea un mapa de Leaflet dentro del elemento HTML que tenga id="mapaSensor"
// setView([latitud, longitud], zoom) define la posición inicial del mapa y su nivel de acercamiento
const mapa = L.map('mapaSensor').setView([10.0777, -84.4857], 15);

// Agrega la capa visual del mapa usando OpenStreetMap
// {s}, {z}, {x}, {y} son variables que Leaflet reemplaza automáticamente para pedir los mosaicos correctos
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors' // Texto de atribución obligatorio para dar crédito a OpenStreetMap
}).addTo(mapa); // Agrega la capa base al mapa creado anteriormente

// Coloca un marcador puntual en la ubicación de la estación de monitoreo
L.marker([10.0777, -84.4857])
  .addTo(mapa) // Agrega el marcador al mapa
  .bindPopup('Estación de Monitoreo') // Asocia una ventana emergente con texto al marcador
  .openPopup(); // Hace que la ventana emergente aparezca abierta al cargar el mapa

// Dibuja un círculo alrededor del punto de monitoreo para resaltar visualmente la estación
L.circle([10.0777, -84.4857], {
  color: '#2196f3', // Color del borde del círculo
  fillColor: '#2196f3', // Color de relleno del círculo
  fillOpacity: 0.2, // Opacidad del relleno (20%)
  radius: 10 // Radio del círculo en metros
}).addTo(mapa); // Agrega el círculo al mapa


// ✅ tu API en Render (UNA SOLA VEZ)
// Guarda en una constante la URL base del backend desplegado en Render
// Esto evita repetir la dirección completa en cada llamada fetch
const API_BASE = "https://api-monitoreo-nube.onrender.com";



// ========== 2. Llenar tablaDatos desde API en Render (autosync cada 5s) ==========
// Define una función asíncrona para actualizar la tabla de últimas mediciones
async function actualizarTablaDatos() {
  try {
    // Hace una petición al endpoint /api/historial solicitando 12 registros
    // { cache: "no-store" } evita que el navegador use datos en caché
    const res = await fetch(`${API_BASE}/api/historial?n=12`, { cache: "no-store" });

    // Convierte la respuesta del servidor a formato JSON
    const data = await res.json();

    // Selecciona el <tbody> de la tabla con id="tablaDatos"
    const tbody = document.querySelector("#tablaDatos tbody");

    // Limpia el contenido previo de la tabla antes de volver a llenarla
    tbody.innerHTML = "";

    // API regresa historial (viejo->nuevo o nuevo->viejo depende),
    // aquí lo forzamos a mostrar más reciente arriba:
    // Invierte el arreglo para mostrar primero el dato más reciente
    data.reverse().forEach(d => {
      // Crea una nueva fila de tabla para cada registro
      const fila = document.createElement("tr");

      // 👇 usa ts_server (porque en tu app.py estás guardando ts_server)
      // Toma el timestamp del registro; intenta primero con ts_server, luego timestamp y si no existe usa cadena vacía
      const ts = d.ts_server || d.timestamp || "";

      // Valor por defecto para la hora si no se puede calcular
      let hora = "--:--";

      if (ts) {
        // Si el timestamp ya viene en formato ISO con "T", lo usa directo
        // Si viene como "YYYY-MM-DD HH:MM:SS", reemplaza el espacio por "T" para hacerlo más compatible
        const iso = ts.includes("T") ? ts : ts.replace(" ", "T");

        // Crea un objeto Date con ese timestamp
        const dt = new Date(iso); // el navegador lo muestra en tu hora local

        // Verifica que la fecha creada sea válida
        if (!isNaN(dt.getTime())) {
          // Convierte la hora a formato local costarricense de dos dígitos para hora y minuto
          hora = dt.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
        }
      }

      // Inserta el contenido HTML de la fila con hora, temperatura y humedad
      fila.innerHTML = `
        <td>${hora}</td>
        <td>${(d.temperatura ?? "-")} °C</td>
        <td>${(d.humedad ?? "-")} %</td>
      `;

      // Agrega la fila construida al cuerpo de la tabla
      tbody.appendChild(fila);
    });

  } catch (e) {
    // Si ocurre cualquier error en la petición o procesamiento, lo muestra en consola
    console.error("Error cargando datos:", e);
  }
}

// Ejecuta la función una vez al cargar el archivo para llenar la tabla inmediatamente
actualizarTablaDatos();

// Programa la ejecución automática de la función cada 5000 ms (5 segundos)
setInterval(actualizarTablaDatos, 5000);


// ================== 3) Tabla Histórica REAL (últimos 5 días) desde API ==================
// Define el intervalo de actualización de la tabla histórica en milisegundos
const HIST_INTERVAL_MS = 30000; // 30s

// Define la zona a consultar en la API; puede usarse para filtrar datos por sensor o región
const ZONA = "Z1";

// helper: convierte {t,h} a "hum | temp"
// Función auxiliar que recibe un objeto de celda con temperatura y humedad
// y devuelve una cadena con formato "humedad | temperatura"
function formatoHumTemp(celdaObj) {
  // Convierte la temperatura a número y la formatea con 2 decimales
  const t = Number(celdaObj.t).toFixed(2);

  // Convierte la humedad a número y la formatea con 2 decimales
  const h = Number(celdaObj.h).toFixed(2);

  // Devuelve texto con formato "humedad | temperatura"
  return `${h} | ${t}`;
}

// Función para crear visualmente el contenedor interno de cada celda histórica
function crearContenedorCelda(texto, tooltip) {
  // Crea un div principal que actuará como contenedor visual de la celda
  const contenedor = document.createElement("div");

  // Activa flexbox para centrar el contenido horizontal y verticalmente
  contenedor.style.display = "flex";
  contenedor.style.justifyContent = "center";
  contenedor.style.alignItems = "center";

  // Hace que ocupe todo el alto y ancho disponible de la celda
  contenedor.style.height = "100%";
  contenedor.style.width = "100%";

  // Aplica un desenfoque tipo glassmorphism al fondo
  contenedor.style.backdropFilter = "blur(4px)";

  // Agrega un fondo blanco semitransparente
  contenedor.style.backgroundColor = "rgba(255, 255, 255, 0.1)";

  // Bordes redondeados
  contenedor.style.borderRadius = "6px";

  // Define tamaño y estilo del texto
  contenedor.style.fontSize = "0.75rem";
  contenedor.style.fontWeight = "bold";
  contenedor.style.color = "white";

  // Asigna texto emergente (tooltip) al pasar el mouse
  contenedor.title = tooltip || "";

  // Crea un span para insertar el texto visible
  const span = document.createElement("span");

  // Inserta el texto recibido
  span.innerText = texto;

  // Mete el span dentro del contenedor
  contenedor.appendChild(span);

  // Devuelve el contenedor ya construido
  return contenedor;
}

// Función principal que pinta toda la tabla histórica con el payload recibido de la API
function pintarTablaHistorica(payload) {
  // Busca la tabla histórica por su id
  const tabla = document.getElementById("tablaHistorica");

  // Si no existe la tabla, sale de la función
  if (!tabla) return;

  // Busca el thead y tbody dentro de la tabla
  const thead = tabla.querySelector("thead");
  const tbody = tabla.querySelector("tbody");

  // Si no existen estas secciones, sale de la función
  if (!thead || !tbody) return;

  // 1) headers (días)
  // Toma la fila del encabezado
  const headerRow = thead.querySelector("tr");

  if (headerRow) {
    // Obtiene todos los th del encabezado
    const ths = headerRow.querySelectorAll("th");

    // Recorre los 5 días y reemplaza sus títulos por los que vienen en payload.dias
    for (let i = 0; i < 5; i++) {
      if (ths[1 + i]) ths[1 + i].innerText = payload.dias?.[i] ?? `Día ${i + 1}`;
    }
  }

  // 2) body
  // Limpia el cuerpo de la tabla antes de volver a llenarlo
  tbody.innerHTML = "";

  // Obtiene el arreglo de horas desde el payload, o un arreglo vacío si no existe
  const horas = payload.horas || [];

  // Obtiene el objeto de celdas desde el payload, o un objeto vacío si no existe
  const celdas = payload.celdas || {};

  // Recorre cada hora para construir una fila completa
  horas.forEach((hora) => {
    // Crea una nueva fila
    const fila = document.createElement("tr");

    // Hora
    // Crea la celda de la hora
    const tdHora = document.createElement("td");

    // Inserta el texto de la hora
    tdHora.innerText = hora;

    // Agrega la celda a la fila
    fila.appendChild(tdHora);

    // 5 días
    // Recorre 5 columnas correspondientes a los 5 días
    for (let d = 0; d < 5; d++) {
      // Crea una celda para cada día
      const td = document.createElement("td");

      // Busca el objeto de celda correspondiente a esa hora y día
      const celdaObj = celdas?.[hora]?.[d] ?? null;

      if (celdaObj) {
        // Si hay datos, forma el texto hum|temp
        const texto = formatoHumTemp(celdaObj);

        // Construye el tooltip con temperatura, humedad y timestamp
        const tooltip = `Temp: ${celdaObj.t}°C | Hum: ${celdaObj.h}%\n${celdaObj.ts || ""}`;

        // Inserta el contenedor visual dentro de la celda
        td.appendChild(crearContenedorCelda(texto, tooltip));
      } else {
        // Si no hay datos, deja la celda vacía
        td.innerHTML = "";
      }

      // Agrega la celda del día a la fila
      fila.appendChild(td);
    }

    // Recomendado
    // Crea una celda final con valores recomendados
    const tdRec = document.createElement("td");

    // Inserta un contenedor visual con valores recomendados fijos
    tdRec.appendChild(crearContenedorCelda("70 | 24", "Recomendado: Temp 23-26°C | Hum 65-75%"));

    // Agrega esta celda a la fila
    fila.appendChild(tdRec);

    // Finalmente agrega la fila completa al cuerpo de la tabla
    tbody.appendChild(fila);
  });
}

// Función asíncrona para pedir datos históricos a la API y pintar la tabla
async function actualizarTablaHistorica() {
  try {
    // Construye la URL incluyendo la zona y un timestamp para evitar caché
    const url = `${API_BASE}/api/historicos?zona=${encodeURIComponent(ZONA)}&t=${Date.now()}`;

    // Hace la petición al endpoint histórico
    const res = await fetch(url, { cache: "no-store" });

    // Si la respuesta HTTP no es correcta, lanza un error
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Convierte la respuesta a JSON
    const payload = await res.json();

    // Pinta la tabla con el payload recibido
    pintarTablaHistorica(payload);
  } catch (err) {
    // Si ocurre error, lo muestra en consola
    console.error("Error /api/historicos:", err);
  }
}

// Llama una vez al cargar para mostrar datos históricos inmediatamente
actualizarTablaHistorica();

// Programa actualización automática cada 30 segundos
setInterval(actualizarTablaHistorica, HIST_INTERVAL_MS);


// ========== 4. Efecto scroll para secciones ==========
// Espera a que el DOM cargue completamente antes de ejecutar este bloque
document.addEventListener("DOMContentLoaded", () => {
  // Selecciona todas las secciones que deben animarse al entrar en pantalla
  const secciones = document.querySelectorAll(".seccion-estudio-blanco, .seccion-estudio-gris");

  // Crea un observador de intersección para detectar cuándo las secciones aparecen en el viewport
  const observer = new IntersectionObserver((entries) => {
    // Recorre todas las entradas observadas
    entries.forEach(entry => {
      // Si la sección está visible dentro del viewport
      if (entry.isIntersecting) {
        // Le agrega la clase que activa la transición visual en CSS
        entry.target.classList.add("seccion-visible");
      }
    });
  }, { threshold: 0.2 }); // La animación se activa cuando al menos 20% del elemento es visible

  // Registra cada sección en el observador
  secciones.forEach(sec => observer.observe(sec));
});
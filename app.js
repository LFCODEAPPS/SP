const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const sectionTitle = document.getElementById('sectionTitle');
const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

const configBtn = document.getElementById('configBtn');
const configMenu = document.getElementById('configMenu');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Obtener la API Key guardada
let API_KEY = localStorage.getItem('tmdb_api_key') || '';

if (API_KEY) {
    apiKeyInput.value = API_KEY;
    fetchTrendingMedia();
} else {
    moviesGrid.innerHTML = '<p class="text-amber-400 col-span-full text-center py-10">Haz clic en <strong>⚙️ Configurar API Key</strong> en la esquina superior derecha para empezar.</p>';
}

// Mostrar / Ocultar menú desplegable de configuración
configBtn.addEventListener('click', () => {
    configMenu.classList.toggle('hidden');
});

// Guardar API Key
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('tmdb_api_key', key);
        API_KEY = key;
        configMenu.classList.add('hidden');
        alert('¡API Key guardada con éxito!');
        fetchTrendingMedia();
    } else {
        alert('Por favor, introduce una clave válida.');
    }
});

// Cargar tendencias (mezcla películas y series)
async function fetchTrendingMedia() {
    if (!API_KEY) return;
    try {
        const response = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=es-ES`);
        const data = await response.json();
        if (data.success === false) {
            moviesGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: ${data.status_message}</p>`;
            return;
        }
        displayMedia(data.results);
    } catch (error) {
        console.error("Error al obtener tendencias:", error);
    }
}

// Búsqueda general
async function searchMedia(query) {
    if (!API_KEY) {
        alert('Primero configura tu API Key.');
        return;
    }

    if (!query.trim()) {
        sectionTitle.textContent = "Tendencias Populares";
        fetchTrendingMedia();
        return;
    }

    sectionTitle.textContent = `Resultados para: "${query}"`;
    try {
        const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        // Filtramos solo películas y series (evitamos personas)
        const filteredResults = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        displayMedia(filteredResults);
    } catch (error) {
        console.error("Error en la búsqueda:", error);
    }
}

// Renderizar tarjetas en la cuadrícula
function displayMedia(items) {
    moviesGrid.innerHTML = '';

    if (!items || items.length === 0) {
        moviesGrid.innerHTML = '<p class="text-zinc-400 col-span-full text-center py-10">No se encontraron resultados.</p>';
        return;
    }

    items.forEach(item => {
        const { id, title, name, poster_path, vote_average, release_date, first_air_date, media_type } = item;
        const mediaTitle = title || name;
        const date = release_date || first_air_date;
        const poster = poster_path ? `${IMG_URL}${poster_path}` : 'https://via.placeholder.com/500x750?text=Sin+Imagen';
        const typeLabel = media_type === 'tv' ? 'Serie' : 'Película';

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${mediaTitle}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded text-zinc-300 uppercase">${typeLabel}</span>
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="p-4 flex flex-col flex-grow justify-between">
                <h3 class="font-bold text-sm text-zinc-100 truncate">${mediaTitle}</h3>
                <p class="text-xs text-zinc-500 mt-1">${date ? date.split('-')[0] : 'Próximamente'}</p>
            </div>
        `;

        card.addEventListener('click', () => fetchMediaDetails(id, media_type || (item.title ? 'movie' : 'tv')));
        moviesGrid.appendChild(card);
    });
}

// Obtener detalles (Película o Serie)
async function fetchMediaDetails(id, type) {
    try {
        const endpoint = type === 'tv' ? `${BASE_URL}/tv/${id}` : `${BASE_URL}/movie/${id}`;
        const res = await fetch(`${endpoint}?api_key=${API_KEY}&language=es-ES`);
        const data = await res.json();

        const resVideos = await fetch(`${endpoint}/videos?api_key=${API_KEY}`);
        const videoData = await resVideos.json();
        const trailer = videoData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');

        if (type === 'tv') {
            showTvModal(data, trailer ? trailer.key : null);
        } else {
            showMovieModal(data, trailer ? trailer.key : null);
        }
    } catch (error) {
        console.error("Error al cargar detalles:", error);
    }
}

// Modal para Películas
function showMovieModal(movie, trailerKey) {
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
    
    modalBody.innerHTML = `
        <div class="relative h-64 sm:h-80 -mx-6 -mt-6 mb-4 bg-cover bg-center flex items-end p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-2xl sm:text-3xl font-black text-white drop-shadow-md">${movie.title}</h2>
        </div>
        <div class="space-y-4 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">
                ${movie.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}
            </div>
            <p class="leading-relaxed text-zinc-400">${movie.overview || 'Sin descripción disponible.'}</p>
            <div class="text-xs text-zinc-500 flex gap-4 pt-2 border-t border-zinc-800">
                <span>Duración: <strong>${movie.runtime} min</strong></span>
                <span>Estreno: <strong>${movie.release_date}</strong></span>
            </div>
            ${trailerKey ? `
                <div class="mt-4">
                    <h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4>
                    <div class="aspect-video w-full rounded-lg overflow-hidden bg-black">
                        <iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            ` : '<p class="text-zinc-500 italic">No hay trailer oficial disponible.</p>'}
        </div>
    `;

    detailModal.classList.remove('hidden');
}

// Modal para Series con Mapa de Calor de Calificaciones por Episodios (Estilo la foto)
async function showTvModal(tv, trailerKey) {
    const backdrop = tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : '';
    
    // Generamos las opciones de las temporadas
    let seasonsHtml = tv.seasons
        .filter(s => s.season_number > 0)
        .map(s => `<option value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} episodios)</option>`)
        .join('');

    modalBody.innerHTML = `
        <div class="relative h-64 sm:h-80 -mx-6 -mt-6 mb-4 bg-cover bg-center flex items-end p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-2xl sm:text-3xl font-black text-white drop-shadow-md">${tv.name}</h2>
        </div>
        <div class="space-y-6 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">
                ${tv.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}
            </div>
            <p class="leading-relaxed text-zinc-400">${tv.overview || 'Sin descripción disponible.'}</p>
            
            <!-- Selector de Temporada para el Mapa de Calor -->
            <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 class="font-bold text-base text-zinc-100">Calificaciones por Episodio</h3>
                    <select id="seasonSelect" class="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-red-600 font-medium">
                        ${seasonsHtml}
                    </select>
                </div>
                
                <!-- Leyenda de colores -->
                <div class="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 pt-1 border-t border-zinc-900">
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> 8.5+ (Excelente)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> 7.5 - 8.4 (Genial)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> 6.5 - 7.4 (Bueno)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> 5.0 - 6.4 (Regular)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> &lt; 5.0 (Malo)</span>
                </div>

                <!-- Cuadrícula de Episodios -->
                <div id="episodesHeatmap" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
                    <p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando calificaciones...</p>
                </div>
            </div>

            ${trailerKey ? `
                <div class="mt-4">
                    <h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4>
                    <div class="aspect-video w-full rounded-lg overflow-hidden bg-black">
                        <iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    detailModal.classList.remove('hidden');

    // Cargar temporada 1 por defecto
    loadSeasonEpisodes(tv.id, 1);

    // Evento al cambiar de temporada en el selector
    document.getElementById('seasonSelect').addEventListener('change', (e) => {
        loadSeasonEpisodes(tv.id, e.target.value);
    });
}

// Función para cargar los episodios de una temporada y pintar el mapa de calor
async function loadSeasonEpisodes(tvId, seasonNumber) {
    const heatmapContainer = document.getElementById('episodesHeatmap');
    heatmapContainer.innerHTML = '<p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando episodios...</p>';

    try {
        const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}&language=es-ES`);
        const seasonData = await res.json();

        if (!seasonData.episodes || seasonData.episodes.length === 0) {
            heatmapContainer.innerHTML = '<p class="text-xs text-zinc-500 col-span-full text-center py-4">No hay información de episodios para esta temporada.</p>';
            return;
        }

        heatmapContainer.innerHTML = '';

        seasonData.episodes.forEach(ep => {
            const rating = ep.vote_average;
            const voteCount = ep.vote_count;
            const ratingText = rating > 0 ? rating.toFixed(1) : 'N/A';

            // Asignación de colores según la calificación (estilo mapa de calor de la foto)
            let bgColor = 'bg-zinc-800 text-zinc-400';
            if (rating >= 8.5) {
                bgColor = 'bg-emerald-600 text-white font-bold';
            } else if (rating >= 7.5) {
                bgColor = 'bg-emerald-700/80 text-white font-semibold';
            } else if (rating >= 6.5) {
                bgColor = 'bg-amber-600 text-white font-semibold';
            } else if (rating >= 5.0) {
                bgColor = 'bg-orange-600 text-white font-semibold';
            } else if (rating > 0) {
                bgColor = 'bg-red-700 text-white font-semibold';
            }

            const epCard = document.createElement('div');
            epCard.className = `p-3 rounded-lg border border-zinc-800 flex flex-col justify-between ${bgColor} transition transform hover:scale-105`;
            epCard.title = `${ep.episode_number}. ${ep.name} - ${ratingText} (${voteCount} votos)`;

            epCard.innerHTML = `
                <div class="flex justify-between items-center text-[11px] opacity-80">
                    <span>E${ep.episode_number}</span>
                    <span>⭐ ${ratingText}</span>
                </div>
                <div class="mt-2 text-xs truncate font-medium" title="${ep.name}">
                    ${ep.episode_number}. ${ep.name}
                </div>
            `;

            heatmapContainer.appendChild(epCard);
        });

    } catch (error) {
        console.error("Error al cargar episodios:", error);
        heatmapContainer.innerHTML = '<p class="text-xs text-red-400 col-span-full text-center py-4">Error al cargar los episodios.</p>';
    }
}

// Cerrar Modal
closeModal.addEventListener('click', () => {
    detailModal.classList.add('hidden');
    modalBody.innerHTML = '';
});

detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
        detailModal.classList.add('hidden');
        modalBody.innerHTML = '';
    }
});

// Búsqueda en tiempo real
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchMedia(e.target.value);
    }, 400);
});

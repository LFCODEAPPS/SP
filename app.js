const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const sectionTitle = document.getElementById('sectionTitle');

const tabCatalog = document.getElementById('tabCatalog');
const tabRecommendations = document.getElementById('tabRecommendations');
const viewCatalog = document.getElementById('viewCatalog');
const viewRecommendations = document.getElementById('viewRecommendations');

const favSearchInput = document.getElementById('favSearchInput');
const favSuggestions = document.getElementById('favSuggestions');
const myFavoritesList = document.getElementById('myFavoritesList');
const recommendationsContainer = document.getElementById('recommendationsContainer');

const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

const configBtn = document.getElementById('configBtn');
const configMenu = document.getElementById('configMenu');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Estado
let API_KEY = localStorage.getItem('tmdb_api_key') || '';
let myFavorites = JSON.parse(localStorage.getItem('fernando_favorites')) || [];

if (API_KEY) {
    apiKeyInput.value = API_KEY;
    fetchTrendingMedia();
    renderFavorites();
} else {
    moviesGrid.innerHTML = '<p class="text-amber-400 col-span-full text-center py-10">Haz clic en el icono <strong>⚙️</strong> arriba a la derecha para ingresar tu API Key.</p>';
}

// Configuración API Key
configBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    configMenu.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
    if (!configMenu.contains(e.target) && !configBtn.contains(e.target)) {
        configMenu.classList.add('hidden');
    }
});
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('tmdb_api_key', key);
        API_KEY = key;
        configMenu.classList.add('hidden');
        alert('¡API Key guardada!');
        fetchTrendingMedia();
    } else {
        alert('Introduce una clave válida.');
    }
});

// Navegación entre Pestañas
tabCatalog.addEventListener('click', () => {
    tabCatalog.className = "px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white transition cursor-pointer";
    tabRecommendations.className = "px-4 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer";
    viewCatalog.classList.remove('hidden');
    viewRecommendations.classList.add('hidden');
});

tabRecommendations.addEventListener('click', () => {
    tabRecommendations.className = "px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white transition cursor-pointer";
    tabCatalog.className = "px-4 py-1.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer";
    viewRecommendations.classList.remove('hidden');
    viewCatalog.classList.add('hidden');
    renderFavorites();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    }
});

// 1. Tendencias del Catálogo
async function fetchTrendingMedia() {
    if (!API_KEY) return;
    try {
        const res = await fetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&language=es-ES`);
        const data = await res.json();
        displayMedia(data.results, moviesGrid);
    } catch (e) { console.error(e); }
}

// Búsqueda en Catálogo
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const q = e.target.value.trim();
        if (!q) {
            sectionTitle.textContent = "Tendencias Populares";
            fetchTrendingMedia();
            return;
        }
        sectionTitle.textContent = `Resultados para: "${q}"`;
        const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(q)}`);
        const data = await res.json();
        displayMedia(data.results.filter(i => i.media_type === 'movie' || i.media_type === 'tv'), moviesGrid);
    }, 400);
});

// Renderizar Cuadrícula
function displayMedia(items, container) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="text-zinc-400 col-span-full text-center py-10">No se encontraron resultados.</p>';
        return;
    }

    items.forEach(item => {
        const { id, title, name, poster_path, vote_average, release_date, first_air_date, media_type } = item;
        const mediaTitle = title || name;
        const date = release_date || first_air_date;
        const poster = poster_path ? `${IMG_URL}${poster_path}` : 'https://via.placeholder.com/500x750?text=Sin+Imagen';
        const realType = media_type || (title ? 'movie' : 'tv');

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${mediaTitle}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded text-zinc-300 uppercase">${realType === 'tv' ? 'Serie' : 'Película'}</span>
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="p-4 flex flex-col flex-grow justify-between">
                <h3 class="font-bold text-sm text-zinc-100 truncate">${mediaTitle}</h3>
                <p class="text-xs text-zinc-500 mt-1">${date ? date.split('-')[0] : ''}</p>
            </div>
        `;
        card.addEventListener('click', () => fetchMediaDetails(id, realType));
        container.appendChild(card);
    });
}

// 2. SISTEMA DE FAVORITOS Y RECOMENDACIONES
let favSearchTimeout;
favSearchInput.addEventListener('input', (e) => {
    clearTimeout(favSearchTimeout);
    const q = e.target.value.trim();
    if (!q) {
        favSuggestions.classList.add('hidden');
        return;
    }
    favSearchTimeout = setTimeout(async () => {
        const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(q)}`);
        const data = await res.json();
        const results = data.results.filter(i => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 5);
        
        if (results.length === 0) {
            favSuggestions.innerHTML = '<div class="p-3 text-xs text-zinc-500">No se encontraron coincidencias.</div>';
        } else {
            favSuggestions.innerHTML = results.map(item => {
                const title = item.title || item.name;
                const type = item.media_type === 'tv' ? 'tv' : 'movie';
                const year = (item.release_date || item.first_air_date || '').split('-')[0];
                return `<div class="p-3 hover:bg-zinc-900 cursor-pointer text-xs flex justify-between items-center border-b border-zinc-900" onclick="addFavorite(${item.id}, '${type}', '${title.replace(/'/g, "")}')">
                    <span><strong>${title}</strong> (${year})</span>
                    <span class="text-red-500 font-bold">+ Agregar</span>
                </div>`;
            }).join('');
        }
        favSuggestions.classList.remove('hidden');
    }, 300);
});

// Cerrar sugerencias al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!favSearchInput.contains(e.target) && !favSuggestions.contains(e.target)) {
        favSuggestions.classList.add('hidden');
    }
});

window.addFavorite = function(id, type, title) {
    if (myFavorites.some(f => f.id === id && f.type === type)) return;
    myFavorites.push({ id, type, title });
    localStorage.setItem('fernando_favorites', JSON.stringify(myFavorites));
    favSearchInput.value = '';
    favSuggestions.classList.add('hidden');
    renderFavorites();
    generateSmartRecommendations();
};

window.removeFavorite = function(id, type) {
    myFavorites = myFavorites.filter(f => !(f.id === id && f.type === type));
    localStorage.setItem('fernando_favorites', JSON.stringify(myFavorites));
    renderFavorites();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    } else {
        recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-10">Agrega al menos una película o serie favorita arriba para generar recomendaciones personalizadas.</p>';
    }
};

function renderFavorites() {
    if (myFavorites.length === 0) {
        myFavoritesList.innerHTML = '<p class="text-xs text-zinc-500 italic">No tienes favoritas registradas aún.</p>';
        return;
    }
    myFavoritesList.innerHTML = myFavorites.map(fav => `
        <span class="bg-zinc-800 border border-zinc-700 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2">
            ${fav.title} (${fav.type === 'tv' ? 'Serie' : 'Película'})
            <button onclick="removeFavorite(${fav.id}, '${fav.type}')" class="text-zinc-400 hover:text-red-500 font-bold cursor-pointer">&times;</button>
        </span>
    `).join('');
}

async function generateSmartRecommendations() {
    if (myFavorites.length === 0) return;
    recommendationsContainer.innerHTML = '<p class="text-center text-zinc-400 py-10">Analizando tus gustos y buscando recomendaciones por género...</p>';

    try {
        let recommendedItemsMap = new Map();

        for (let fav of myFavorites) {
            const res = await fetch(`${BASE_URL}/${fav.type}/${fav.id}/recommendations?api_key=${API_KEY}&language=es-ES`);
            const data = await res.json();
            if (data.results) {
                data.results.forEach(item => {
                    if (!myFavorites.some(f => f.id === item.id)) {
                        recommendedItemsMap.set(item.id, { ...item, media_type: fav.type });
                    }
                });
            }
        }

        let allRecs = Array.from(recommendedItemsMap.values());

        if (allRecs.length === 0) {
            recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-10">No hay suficientes recomendaciones aún. ¡Agrega más favoritas!</p>';
            return;
        }

        const genreRes = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=es-ES`);
        const genreData = await genreRes.json();
        const genreMap = new Map(genreData.genres.map(g => [g.id, g.name]));

        let groupedByGenre = {};
        allRecs.forEach(item => {
            const genreIds = item.genre_ids || [];
            genreIds.forEach(gId => {
                const genreName = genreMap.get(gId) || 'Otros';
                if (!groupedByGenre[genreName]) groupedByGenre[genreName] = [];
                if (!groupedByGenre[genreName].some(existing => existing.id === item.id)) {
                    groupedByGenre[genreName].push(item);
                }
            });
        });

        recommendationsContainer.innerHTML = '';
        for (let [genre, items] of Object.entries(groupedByGenre)) {
            if (items.length === 0) continue;

            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'space-y-4';
            sectionDiv.innerHTML = `
                <h3 class="text-lg font-bold text-zinc-200 border-l-4 border-red-600 pl-3">${genre}</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6" id="genre-grid-${genre.replace(/\s+/g, '')}"></div>
            `;
            recommendationsContainer.appendChild(sectionDiv);

            const gridTarget = document.getElementById(`genre-grid-${genre.replace(/\s+/g, '')}`);
            displayMedia(items.slice(0, 5), gridTarget);
        }

    } catch (error) {
        console.error("Error generando recomendaciones:", error);
        recommendationsContainer.innerHTML = '<p class="text-center text-red-400 py-10">Ocurrió un error al calcular tus recomendaciones.</p>';
    }
}

// 3. DETALLES Y MAPA DE CALOR
async function fetchMediaDetails(id, type) {
    try {
        let endpoint = `${BASE_URL}/${type}/${id}`;
        let res = await fetch(`${endpoint}?api_key=${API_KEY}&language=es-ES`);
        let data = await res.json();

        if (type === 'movie' && !data.runtime && data.number_of_seasons) type = 'tv';

        const resVideos = await fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}`);
        const videoData = await resVideos.json();
        const trailer = videoData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');

        if (type === 'tv') showTvModal(data, trailer ? trailer.key : null);
        else showMovieModal(data, trailer ? trailer.key : null);
    } catch (e) { console.error(e); }
}

function showMovieModal(movie, trailerKey) {
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
    modalBody.innerHTML = `
        <div class="relative h-64 sm:h-80 -mx-6 -mt-6 mb-4 bg-cover bg-center flex items-end p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-2xl sm:text-3xl font-black text-white drop-shadow-md">${movie.title}</h2>
        </div>
        <div class="space-y-4 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">${movie.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}</div>
            <p class="leading-relaxed text-zinc-400">${movie.overview || 'Sin descripción.'}</p>
            <div class="text-xs text-zinc-500 flex gap-4 pt-2 border-t border-zinc-800">
                <span>Duración: <strong>${movie.runtime} min</strong></span>
                <span>Estreno: <strong>${movie.release_date}</strong></span>
            </div>
            ${trailerKey ? `<div class="mt-4"><h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4><div class="aspect-video w-full rounded-lg overflow-hidden bg-black"><iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div></div>` : ''}
        </div>
    `;
    detailModal.classList.remove('hidden');
}

async function showTvModal(tv, trailerKey) {
    const backdrop = tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : '';
    let seasonsHtml = tv.seasons.filter(s => s.season_number > 0).map(s => `<option value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} eps)</option>`).join('');

    modalBody.innerHTML = `
        <div class="relative h-64 sm:h-80 -mx-6 -mt-6 mb-4 bg-cover bg-center flex items-end p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-2xl sm:text-3xl font-black text-white drop-shadow-md">${tv.name}</h2>
        </div>
        <div class="space-y-6 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">${tv.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}</div>
            <p class="leading-relaxed text-zinc-400">${tv.overview || 'Sin descripción.'}</p>
            
            <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 class="font-bold text-base text-zinc-100">Calificaciones por Episodio</h3>
                    <select id="seasonSelect" class="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg font-medium">${seasonsHtml}</select>
                </div>
                <div id="episodesHeatmap" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
                    <p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando episodios...</p>
                </div>
            </div>

            ${trailerKey ? `<div class="mt-4"><h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4><div class="aspect-video w-full rounded-lg overflow-hidden bg-black"><iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div></div>` : ''}
        </div>
    `;
    detailModal.classList.remove('hidden');
    loadSeasonEpisodes(tv.id, 1);
    document.getElementById('seasonSelect').addEventListener('change', (e) => loadSeasonEpisodes(tv.id, e.target.value));
}

async function loadSeasonEpisodes(tvId, seasonNumber) {
    const container = document.getElementById('episodesHeatmap');
    container.innerHTML = '<p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando...</p>';
    try {
        const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}&language=es-ES`);
        const data = await res.json();
        if (!data.episodes) return;
        container.innerHTML = data.episodes.map(ep => {
            const r = ep.vote_average;
            let bg = 'bg-zinc-800 text-zinc-400';
            if (r >= 8.5) bg = 'bg-emerald-600 text-white font-bold';
            else if (r >= 7.5) bg = 'bg-emerald-700/80 text-white font-semibold';
            else if (r >= 6.5) bg = 'bg-amber-600 text-white font-semibold';
            else if (r >= 5.0) bg = 'bg-orange-600 text-white font-semibold';
            else if (r > 0) bg = 'bg-red-700 text-white font-semibold';

            return `<div class="p-3 rounded-lg border border-zinc-800 flex flex-col justify-between ${bg}" title="E${ep.episode_number}: ${ep.name} - ⭐${r.toFixed(1)}">
                <div class="flex justify-between items-center text-[11px] opacity-90"><span>E${ep.episode_number}</span><span>⭐ ${r > 0 ? r.toFixed(1) : 'N/A'}</span></div>
                <div class="mt-2 text-xs truncate font-medium">${ep.episode_number}. ${ep.name}</div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

closeModal.addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) detailModal.classList.add('hidden'); });

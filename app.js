const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');

const favSearchInput = document.getElementById('favSearchInput');
const favSuggestions = document.getElementById('favSuggestions');
const myFavoritesList = document.getElementById('myFavoritesList');
const recommendationsContainer = document.getElementById('recommendationsContainer');

const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Estado
let API_KEY = localStorage.getItem('tmdb_api_key') || '';
let myFavorites = JSON.parse(localStorage.getItem('fernando_favorites')) || [];

if (API_KEY) {
    apiKeyInput.value = API_KEY;
    renderFavorites();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    }
} else {
    recommendationsContainer.innerHTML = '<p class="text-center text-amber-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">Haz clic en el botón hamburguesa <strong>(≡)</strong> arriba a la derecha para ingresar tu TMDB API Key.</p>';
}

// Abrir / Cerrar Menú Hamburguesa con soporte táctil completo (click y touchend)
function toggleMenu(e) {
    e.stopPropagation();
    e.preventDefault();
    menuDropdown.classList.toggle('hidden');
}

menuBtn.addEventListener('click', toggleMenu);
menuBtn.addEventListener('touchend', toggleMenu);

// Evitar que hacer clic dentro del menú lo cierre por accidente
menuDropdown.addEventListener('click', (e) => e.stopPropagation());
menuDropdown.addEventListener('touchend', (e) => e.stopPropagation());

// Cerrar menú si se hace clic fuera
document.addEventListener('click', () => {
    menuDropdown.classList.add('hidden');
    favSuggestions.classList.add('hidden');
});

// Guardar API Key
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('tmdb_api_key', key);
        API_KEY = key;
        menuDropdown.classList.add('hidden');
        alert('¡API Key guardada con éxito!');
        renderFavorites();
        if (myFavorites.length > 0) generateSmartRecommendations();
    } else {
        alert('Introduce una clave válida.');
    }
});

// BUSCADOR DINÁMICO DENTRO DEL MENÚ
let favSearchTimeout;
favSearchInput.addEventListener('input', (e) => {
    clearTimeout(favSearchTimeout);
    const q = e.target.value.trim();
    
    if (!q || !API_KEY) {
        favSuggestions.classList.add('hidden');
        favSuggestions.innerHTML = '';
        return;
    }

    favSearchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(q)}`);
            const data = await res.json();
            const results = (data.results || []).filter(i => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 5);
            
            if (results.length === 0) {
                favSuggestions.innerHTML = '<div class="p-3 text-xs text-zinc-500">No se encontraron coincidencias.</div>';
            } else {
                favSuggestions.innerHTML = results.map(item => {
                    const title = item.title || item.name;
                    const type = item.media_type;
                    const year = (item.release_date || item.first_air_date || '').split('-')[0];
                    const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `<div class="p-2.5 hover:bg-zinc-900 cursor-pointer text-xs flex justify-between items-center border-b border-zinc-900/50 transition" onclick="addFavorite(${item.id}, '${type}', '${safeTitle}')">
                        <span class="truncate pr-2 text-zinc-200"><strong>${title}</strong> (${year || 'N/A'})</span>
                        <span class="text-red-500 font-bold whitespace-nowrap">+ Agregar</span>
                    </div>`;
                }).join('');
            }
            favSuggestions.classList.remove('hidden');
        } catch (err) {
            console.error("Error buscando:", err);
        }
    }, 250);
});

window.addFavorite = function(id, type, title) {
    if (myFavorites.some(f => f.id === id && f.type === type)) {
        favSearchInput.value = '';
        favSuggestions.classList.add('hidden');
        return;
    }
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
        recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4 text-xs sm:text-sm">Agrega al menos una película o serie favorita en el menú hamburguesa para comenzar.</p>';
    }
};

// RENDERIZAR LISTA DENTRO DEL MENÚ
function renderFavorites() {
    if (myFavorites.length === 0) {
        myFavoritesList.innerHTML = '<p class="text-xs text-zinc-500 italic text-center py-2">No hay elementos registrados.</p>';
        return;
    }
    myFavoritesList.innerHTML = myFavorites.map(fav => `
        <div class="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl flex justify-between items-center text-xs group hover:border-zinc-700 transition">
            <span class="truncate pr-2 font-medium text-zinc-200" title="${fav.title}">${fav.title}</span>
            <div class="flex items-center gap-2">
                <span class="text-[9px] text-zinc-500 uppercase">${fav.type === 'tv' ? 'Serie' : 'Película'}</span>
                <button type="button" onclick="removeFavorite(${fav.id}, '${fav.type}')" class="text-zinc-400 hover:text-red-500 font-bold text-base px-1.5 cursor-pointer transition" title="Eliminar">&times;</button>
            </div>
        </div>
    `).join('');
}

// GENERAR RECOMENDACIONES POR GÉNERO
async function generateSmartRecommendations() {
    if (myFavorites.length === 0 || !API_KEY) return;
    recommendationsContainer.innerHTML = '<p class="text-center text-zinc-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900">Analizando tus gustos y buscando recomendaciones por género...</p>';

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
            recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">No hay suficientes recomendaciones para los elementos actuales. ¡Prueba agregando otras series o películas!</p>';
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
                <h3 class="text-base sm:text-lg font-bold text-zinc-200 border-l-4 border-red-600 pl-3">${genre}</h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="genre-grid-${genre.replace(/\s+/g, '')}"></div>
            `;
            recommendationsContainer.appendChild(sectionDiv);

            const gridTarget = document.getElementById(`genre-grid-${genre.replace(/\s+/g, '')}`);
            displayMediaCards(items.slice(0, 5), gridTarget);
        }

    } catch (error) {
        console.error("Error generando recomendaciones:", error);
        recommendationsContainer.innerHTML = '<p class="text-center text-red-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900">Ocurrió un error al calcular tus recomendaciones.</p>';
    }
}

// RENDERIZAR TARJETAS
function displayMediaCards(items, container) {
    container.innerHTML = '';
    items.forEach(item => {
        const { id, title, name, poster_path, vote_average, release_date, first_air_date, media_type } = item;
        const mediaTitle = title || name;
        const date = release_date || first_air_date;
        const poster = poster_path ? `${IMG_URL}${poster_path}` : 'https://via.placeholder.com/500x750?text=Sin+Imagen';
        const realType = media_type || (title ? 'movie' : 'tv');

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${mediaTitle}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-[9px] font-bold px-1.5 py-0.5 rounded text-zinc-300 uppercase">${realType === 'tv' ? 'Serie' : 'Película'}</span>
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="p-3 flex flex-col flex-grow justify-between">
                <h4 class="font-bold text-xs text-zinc-100 truncate">${mediaTitle}</h4>
                <p class="text-[11px] text-zinc-500 mt-0.5">${date ? date.split('-')[0] : ''}</p>
            </div>
        `;
        card.addEventListener('click', () => fetchMediaDetails(id, realType));
        container.appendChild(card);
    });
}

// DETALLES Y MAPA DE CALOR
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
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-xl sm:text-2xl font-black text-white drop-shadow-md">${movie.title}</h2>
        </div>
        <div class="space-y-4 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">${movie.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}</div>
            <p class="leading-relaxed text-zinc-400 text-xs sm:text-sm">${movie.overview || 'Sin descripción.'}</p>
            <div class="text-xs text-zinc-500 flex gap-4 pt-2 border-t border-zinc-800">
                <span>Duración: <strong>${movie.runtime} min</strong></span>
                <span>Estreno: <strong>${movie.release_date}</strong></span>
            </div>
            ${trailerKey ? `<div class="mt-4"><h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4><div class="aspect-video w-full rounded-xl overflow-hidden bg-black"><iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div></div>` : ''}
        </div>
    `;
    detailModal.classList.remove('hidden');
}

async function showTvModal(tv, trailerKey) {
    const backdrop = tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : '';
    let seasonsHtml = tv.seasons.filter(s => s.season_number > 0).map(s => `<option value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} eps)</option>`).join('');

    modalBody.innerHTML = `
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <h2 class="relative z-10 text-xl sm:text-2xl font-black text-white drop-shadow-md">${tv.name}</h2>
        </div>
        <div class="space-y-6 text-sm text-zinc-300">
            <div class="flex flex-wrap gap-2">${tv.genres.map(g => `<span class="bg-zinc-800 text-red-500 font-semibold px-3 py-1 rounded-full text-xs">${g.name}</span>`).join('')}</div>
            <p class="leading-relaxed text-zinc-400 text-xs sm:text-sm">${tv.overview || 'Sin descripción.'}</p>
            
            <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 class="font-bold text-sm sm:text-base text-zinc-100">Calificaciones por Episodio</h3>
                    <select id="seasonSelect" class="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg font-medium">${seasonsHtml}</select>
                </div>
                <div id="episodesHeatmap" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
                    <p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando episodios...</p>
                </div>
            </div>

            ${trailerKey ? `<div class="mt-4"><h4 class="font-bold text-zinc-200 mb-2">Trailer Oficial</h4><div class="aspect-video w-full rounded-xl overflow-hidden bg-black"><iframe src="https://www.youtube.com/embed/${trailerKey}" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div></div>` : ''}
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

            return `<div class="p-2.5 rounded-lg border border-zinc-800 flex flex-col justify-between ${bg}" title="E${ep.episode_number}: ${ep.name} - ⭐${r.toFixed(1)}">
                <div class="flex justify-between items-center text-[10px] opacity-90"><span>E${ep.episode_number}</span><span>⭐ ${r > 0 ? r.toFixed(1) : 'N/A'}</span></div>
                <div class="mt-1 text-[11px] truncate font-medium">${ep.episode_number}. ${ep.name}</div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

closeModal.addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) detailModal.classList.add('hidden'); });

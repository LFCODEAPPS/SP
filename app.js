// --- FUNCIÓN GLOBAL DE APERTURA DEL MENÚ ---
window.toggleMenu = function(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    const menu = document.getElementById('menuDropdown');
    if (menu) {
        menu.classList.toggle('hidden');
    }
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('menuDropdown');
    const btn = document.getElementById('menuBtn');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add('hidden');
    }
    const suggestions = document.getElementById('favSuggestions');
    if (suggestions) {
        suggestions.classList.add('hidden');
    }
});

const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const favSearchInput = document.getElementById('favSearchInput');
const favSuggestions = document.getElementById('favSuggestions');
const myFavoritesList = document.getElementById('myFavoritesList');
const recommendationsContainer = document.getElementById('recommendationsContainer');
const genresBar = document.getElementById('genresBar');

const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Estado
let API_KEY = localStorage.getItem('tmdb_api_key') || '';
let rawFavorites = JSON.parse(localStorage.getItem('fernando_favorites')) || [];
let myFavorites = rawFavorites.filter(item => item && typeof item === 'object' && item.id && item.type);

// Filtros activos
let currentTypeFilter = 'all'; // 'all', 'tv', 'movie'
let currentGenreFilter = 'all';
let allLoadedRecommendations = [];
let genreMap = new Map();

if (API_KEY) {
    apiKeyInput.value = API_KEY;
    renderFavorites();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    }
} else {
    recommendationsContainer.innerHTML = '<p class="text-center text-amber-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">Haz clic en el botón hamburguesa <strong>(≡)</strong> para ingresar tu TMDB API Key.</p>';
}

saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('tmdb_api_key', key);
        API_KEY = key;
        const menu = document.getElementById('menuDropdown');
        if (menu) menu.classList.add('hidden');
        alert('¡API Key guardada con éxito!');
        renderFavorites();
        if (myFavorites.length > 0) generateSmartRecommendations();
    } else {
        alert('Introduce una clave válida.');
    }
});

// BUSCADOR EN EL MENÚ
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
    myFavorites.unshift({ id, type, title });
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
        allLoadedRecommendations = [];
        genresBar.innerHTML = '';
        recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4 text-xs sm:text-sm">Agrega al menos una película o serie favorita en el menú hamburguesa para comenzar.</p>';
    }
};

function renderFavorites() {
    if (myFavorites.length === 0) {
        myFavoritesList.innerHTML = '<p class="text-xs text-zinc-500 italic text-center py-2">No hay elementos registrados.</p>';
        return;
    }
    myFavoritesList.innerHTML = myFavorites.map(fav => `
        <div class="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl flex justify-between items-center text-xs group hover:border-zinc-700 transition">
            <span class="truncate pr-2 font-medium text-zinc-200" title="${fav.title}">${fav.title}</span>
            <div class="flex items-center gap-2">
                <span class="text-[9px] ${fav.type === 'tv' ? 'text-emerald-400 font-semibold' : 'text-amber-500 font-semibold'} uppercase">${fav.type === 'tv' ? 'Serie' : 'Película'}</span>
                <button type="button" onclick="removeFavorite(${fav.id}, '${fav.type}')" class="text-zinc-400 hover:text-red-500 font-bold text-base px-1.5 cursor-pointer transition" title="Eliminar">&times;</button>
            </div>
        </div>
    `).join('');
}

// CONTROL DE FILTRO: TODO / SERIES / PELÍCULAS
window.setTypeFilter = function(type) {
    currentTypeFilter = type;
    currentGenreFilter = 'all'; // reiniciar género al cambiar categoría principal

    const btnAll = document.getElementById('filterAll');
    const btnTv = document.getElementById('filterTv');
    const btnMovie = document.getElementById('filterMovie');

    const activeClasses = "bg-red-600 text-white border-red-500 shadow-lg";
    const inactiveClasses = "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700";

    btnAll.className = `py-3 rounded-2xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 border transition active:scale-95 cursor-pointer ${type === 'all' ? activeClasses : inactiveClasses}`;
    btnTv.className = `py-3 rounded-2xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 border transition active:scale-95 cursor-pointer ${type === 'tv' ? activeClasses : inactiveClasses}`;
    btnMovie.className = `py-3 rounded-2xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center gap-1 border transition active:scale-95 cursor-pointer ${type === 'movie' ? activeClasses : inactiveClasses}`;

    updateGenresBar();
    renderFilteredFeed();
};

// CONTROL DE FILTRO DE GÉNERO
window.setGenreFilter = function(genreName) {
    currentGenreFilter = genreName;
    updateGenresBar();
    renderFilteredFeed();
};

// ACTUALIZAR BARRA HORIZONTAL DE GÉNEROS
function updateGenresBar() {
    // Filtrar según el tipo actual (todo, tv, movie)
    let availableItems = allLoadedRecommendations.filter(item => {
        if (currentTypeFilter === 'all') return true;
        return item.media_type === currentTypeFilter;
    });

    let genresSet = new Set();
    availableItems.forEach(item => {
        (item.genre_ids || []).forEach(gId => {
            const name = genreMap.get(gId);
            if (name) genresSet.add(name);
        });
    });

    const genresList = Array.from(genresSet).sort();

    let html = `
        <button onclick="setGenreFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${currentGenreFilter === 'all' ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}">
            Todos los géneros
        </button>
    `;

    genresList.forEach(genre => {
        const isSelected = currentGenreFilter === genre;
        html += `
            <button onclick="setGenreFilter('${genre}')" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${isSelected ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}">
                ${genre}
            </button>
        `;
    });

    genresBar.innerHTML = html;
}

// OBTENER RECOMENDACIONES DE LA API
async function generateSmartRecommendations() {
    if (myFavorites.length === 0 || !API_KEY) return;
    recommendationsContainer.innerHTML = '<p class="text-center text-zinc-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900">Analizando tus gustos con balance equitativo...</p>';

    try {
        const favoriteKeywords = myFavorites.map(f => {
            return f.title.toLowerCase().replace(/[:\-0-9]/g, '').trim().split(' ')[0];
        }).filter(w => w.length > 3);

        const fetchPromises = myFavorites.map(async (fav) => {
            try {
                const [recsRes, simRes] = await Promise.all([
                    fetch(`${BASE_URL}/${fav.type}/${fav.id}/recommendations?api_key=${API_KEY}&language=es-ES`),
                    fetch(`${BASE_URL}/${fav.type}/${fav.id}/similar?api_key=${API_KEY}&language=es-ES`)
                ]);
                const recsData = await recsRes.json();
                const simData = await simRes.json();

                const combined = [...(recsData.results || []), ...(simData.results || [])];

                const filtered = combined.filter(item => {
                    const itemTitle = (item.title || item.name || '').toLowerCase();
                    const isAlreadyFav = myFavorites.some(f => f.id === item.id);
                    const isSameFranchise = favoriteKeywords.some(kw => itemTitle.includes(kw));
                    return !isAlreadyFav && !isSameFranchise;
                });

                return filtered.slice(0, 6).map(item => ({ ...item, media_type: fav.type }));
            } catch (err) {
                return [];
            }
        });

        const resultsByFavorite = await Promise.all(fetchPromises);

        let maxLen = Math.max(...resultsByFavorite.map(arr => arr.length));
        let candidatesPool = [];
        let seenIds = new Set();

        for (let i = 0; i < maxLen; i++) {
            for (let list of resultsByFavorite) {
                if (list[i] && !seenIds.has(list[i].id)) {
                    seenIds.add(list[i].id);
                    candidatesPool.push(list[i]);
                }
            }
        }

        allLoadedRecommendations = candidatesPool;

        // Cargar mapa de nombres de géneros (películas y series)
        const [genreMovieRes, genreTvRes] = await Promise.all([
            fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=es-ES`),
            fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}&language=es-ES`)
        ]);
        const genreMovieData = await genreMovieRes.json();
        const genreTvData = await genreTvRes.json();
        
        genreMap = new Map();
        (genreMovieData.genres || []).forEach(g => genreMap.set(g.id, g.name));
        (genreTvData.genres || []).forEach(g => genreMap.set(g.id, g.name));

        updateGenresBar();
        renderFilteredFeed();

    } catch (error) {
        console.error("Error generando recomendaciones:", error);
        recommendationsContainer.innerHTML = '<p class="text-center text-red-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900">Ocurrió un error al calcular tus recomendaciones.</p>';
    }
}

// RENDERIZAR FEED CON LOS FILTROS APLICADOS
function renderFilteredFeed() {
    let filtered = allLoadedRecommendations;

    // Filtro por Tipo (Todo / Series / Películas)
    if (currentTypeFilter !== 'all') {
        filtered = filtered.filter(item => item.media_type === currentTypeFilter);
    }

    // Filtro por Género
    if (currentGenreFilter !== 'all') {
        filtered = filtered.filter(item => {
            const itemGenres = (item.genre_ids || []).map(id => genreMap.get(id));
            return itemGenres.includes(currentGenreFilter);
        });
    }

    if (filtered.length === 0) {
        recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">No hay títulos disponibles para esta combinación de filtros.</p>';
        return;
    }

    // Agrupar por género
    let groupedByGenre = {};
    filtered.forEach(item => {
        const genreIds = item.genre_ids || [];
        genreIds.forEach(gId => {
            const genreName = genreMap.get(gId) || 'Otros';
            // Si hay un género específico seleccionado, solo poblar ese grupo
            if (currentGenreFilter !== 'all' && genreName !== currentGenreFilter) return;

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

        const typeBadge = realType === 'tv' 
            ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">Serie</span>' 
            : '<span class="text-[10px] font-bold text-amber-500 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">Película</span>';

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${mediaTitle}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="p-3 flex flex-col flex-grow justify-between gap-1.5">
                <div class="flex items-center gap-1.5 overflow-hidden">
                    ${typeBadge}
                    <h4 class="font-bold text-xs text-zinc-100 truncate">${mediaTitle}</h4>
                </div>
                <p class="text-[11px] text-zinc-500">${date ? date.split('-')[0] : ''}</p>
            </div>
        `;
        card.addEventListener('click', () => fetchMediaDetails(id, realType));
        container.appendChild(card);
    });
}

// DETALLES Y PROVEEDORES
async function fetchMediaDetails(id, type) {
    try {
        let endpoint = `${BASE_URL}/${type}/${id}`;
        let [resData, resProviders] = await Promise.all([
            fetch(`${endpoint}?api_key=${API_KEY}&language=es-ES`),
            fetch(`${endpoint}/watch/providers?api_key=${API_KEY}`)
        ]);

        let data = await resData.json();
        let providersData = await resProviders.json();

        const results = providersData.results || {};
        const localProviders = results.PE || results.MX || results.ES || results.US || {};
        const flatrate = localProviders.flatrate || localProviders.buy || [];

        if (type === 'movie' && !data.runtime && data.number_of_seasons) type = 'tv';

        if (type === 'tv') {
            showTvModal(data, flatrate);
        } else {
            showMovieModal(data, flatrate);
        }
    } catch (e) { console.error(e); }
}

function getProvidersHtml(providers) {
    if (!providers || providers.length === 0) {
        return '<p class="text-xs text-zinc-500 italic">No hay plataformas de streaming registradas para tu región.</p>';
    }
    return `
        <div class="flex flex-wrap items-center gap-3">
            ${providers.map(p => `
                <div class="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded-xl">
                    <img src="https://image.tmdb.org/t/p/w92${p.logo_path}" alt="${p.provider_name}" class="w-5 h-5 rounded-md object-cover">
                    <span class="text-xs font-medium text-zinc-200">${p.provider_name}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function showMovieModal(movie, providers) {
    const backdrop = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const voteCount = movie.vote_count ? movie.vote_count.toLocaleString() : '0';

    const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer espanol latino')}`;
    const reviewSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' critica reseña')}`;

    modalBody.innerHTML = `
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <div class="relative z-10 space-y-1">
                <span class="text-[10px] font-bold text-amber-500 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded uppercase">Película</span>
                <h2 class="text-xl sm:text-2xl font-black text-white drop-shadow-md">${movie.title}</h2>
            </div>
        </div>

        <div class="space-y-5 text-sm text-zinc-300">
            <div class="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <span class="text-xl">⭐</span>
                <div>
                    <div class="text-sm font-bold text-white">${rating} / 10 <span class="text-xs font-normal text-zinc-400">calificación del público</span></div>
                    <div class="text-[11px] text-zinc-500">${voteCount} votos registrados</div>
                </div>
            </div>

            <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Dónde ver</h4>
                ${getProvidersHtml(providers)}
            </div>

            <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Sinopsis</h4>
                <p class="leading-relaxed text-zinc-400 text-xs sm:text-sm">${movie.overview || 'Sin descripción disponible.'}</p>
            </div>

            <div class="text-xs text-zinc-500 flex gap-4 pt-1">
                <span>Duración: <strong>${movie.runtime || 'N/A'} min</strong></span>
                <span>Estreno: <strong>${movie.release_date || 'N/A'}</strong></span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a href="${trailerSearchUrl}" target="_blank" rel="noopener noreferrer" class="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg">
                    <span>▶ Ver Trailer en YouTube (Latino)</span>
                </a>
                <a href="${reviewSearchUrl}" target="_blank" rel="noopener noreferrer" class="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition">
                    <span>💬 Ver Crítica más vista en YouTube</span>
                </a>
            </div>
        </div>
    `;
    detailModal.classList.remove('hidden');
}

async function showTvModal(tv, providers) {
    const backdrop = tv.backdrop_path ? `https://image.tmdb.org/t/p/original${tv.backdrop_path}` : '';
    const rating = tv.vote_average ? tv.vote_average.toFixed(1) : 'N/A';
    const voteCount = tv.vote_count ? tv.vote_count.toLocaleString() : '0';

    let seasonsHtml = tv.seasons.filter(s => s.season_number > 0).map(s => `<option value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} eps)</option>`).join('');

    const reviewSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' critica serie resena')}`;

    modalBody.innerHTML = `
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <div class="relative z-10 space-y-1">
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded uppercase">Serie</span>
                <h2 class="text-xl sm:text-2xl font-black text-white drop-shadow-md">${tv.name}</h2>
            </div>
        </div>

        <div class="space-y-5 text-sm text-zinc-300">
            <div class="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <span class="text-xl">⭐</span>
                <div>
                    <div class="text-sm font-bold text-white">${rating} / 10 <span class="text-xs font-normal text-zinc-400">calificación del público</span></div>
                    <div class="text-[11px] text-zinc-500">${voteCount} votos registrados</div>
                </div>
            </div>

            <div class="space-y-2">
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Dónde ver</h4>
                ${getProvidersHtml(providers)}
            </div>

            <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-zinc-200 uppercase tracking-wider">Sinopsis</h4>
                <p class="leading-relaxed text-zinc-400 text-xs sm:text-sm">${tv.overview || 'Sin descripción disponible.'}</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a id="seasonTrailerBtn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' temporada 1 trailer espanol latino')}" target="_blank" rel="noopener noreferrer" class="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg">
                    <span>▶ Ver Trailer Temporada 1 (Latino)</span>
                </a>
                <a href="${reviewSearchUrl}" target="_blank" rel="noopener noreferrer" class="bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition">
                    <span>💬 Ver Crítica en YouTube</span>
                </a>
            </div>

            <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 class="font-bold text-sm sm:text-base text-zinc-100">Calificaciones por Episodio</h3>
                    <select id="seasonSelect" class="bg-zinc-800 border border-zinc-700 text-xs px-3 py-2 rounded-lg font-medium">${seasonsHtml}</select>
                </div>
                <div id="episodesHeatmap" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
                    <p class="text-xs text-zinc-500 col-span-full text-center py-4">Cargando episodios...</p>
                </div>
            </div>
        </div>
    `;
    detailModal.classList.remove('hidden');
    loadSeasonEpisodes(tv.id, 1);

    document.getElementById('seasonSelect').addEventListener('change', (e) => {
        const seasonNum = e.target.value;
        loadSeasonEpisodes(tv.id, seasonNum);
        
        const trailerBtn = document.getElementById('seasonTrailerBtn');
        if (trailerBtn) {
            trailerBtn.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' temporada ' + seasonNum + ' trailer espanol latino')}`;
            trailerBtn.querySelector('span').textContent = `▶ Ver Trailer Temporada ${seasonNum} (Latino)`;
        }
    });
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

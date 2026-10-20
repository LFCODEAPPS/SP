// --- CONFIGURACIÓN DE FIREBASE OFICIAL ---
const firebaseConfig = {
    apiKey: "AIzaSyC6uQzOIIt2vM54CR27G4hvJDWz_NKv61Y",
    authDomain: "el-baul-de-fernando.firebaseapp.com",
    projectId: "el-baul-de-fernando",
    storageBucket: "el-baul-de-fernando.firebasestorage.app",
    messagingSenderId: "648436947805",
    appId: "1:648436947805:web:9d7e3f2e326c8b69f766b4",
    measurementId: "G-7JYXDWNSHM"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// TMDB API
const API_KEY = '7d59a5a92c91b35391c39a6491fa05f9';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

// Elementos de la interfaz
const viewFeed = document.getElementById('viewFeed');
const viewWatchlist = document.getElementById('viewWatchlist');
const viewFavorites = document.getElementById('viewFavorites');

const navFeed = document.getElementById('navFeed');
const navWatchlist = document.getElementById('navWatchlist');
const navFavorites = document.getElementById('navFavorites');

const badgeWatchlist = document.getElementById('badgeWatchlist');
const badgeFavorites = document.getElementById('badgeFavorites');

const recommendationsContainer = document.getElementById('recommendationsContainer');
const watchlistGrid = document.getElementById('watchlistGrid');
const favoritesGrid = document.getElementById('favoritesGrid');
const genresBar = document.getElementById('genresBar');

const favSearchInput = document.getElementById('favSearchInput');
const favSuggestions = document.getElementById('favSuggestions');

const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

const authContainerDesktop = document.getElementById('authContainerDesktop');
const authContainerMobile = document.getElementById('authContainerMobile');

// Estado
let currentUser = null;
let myFavorites = JSON.parse(localStorage.getItem('fernando_favorites')) || [];
let myWatchlistItems = JSON.parse(localStorage.getItem('fernando_watchlist')) || [];

let currentTypeFilter = 'all';
let currentGenreFilter = 'all';
let allLoadedRecommendations = [];
let genreMap = new Map();

// --- AUTENTICACIÓN GOOGLE SIGN-IN ---
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    renderAuthButtons();

    if (user) {
        await loadUserDataFromCloud(user.uid);
    } else {
        myFavorites = JSON.parse(localStorage.getItem('fernando_favorites')) || [];
        myWatchlistItems = JSON.parse(localStorage.getItem('fernando_watchlist')) || [];
    }

    updateBadges();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    }
});

function renderAuthButtons() {
    const authHtml = currentUser ? `
        <div class="flex items-center gap-2">
            <img src="${currentUser.photoURL || 'https://via.placeholder.com/32'}" alt="${currentUser.displayName}" class="w-7 h-7 rounded-full border border-zinc-700 object-cover">
            <span class="text-xs font-semibold text-zinc-300 hidden md:inline truncate max-w-[100px]">${currentUser.displayName.split(' ')[0]}</span>
            <button onclick="logoutGoogle()" class="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-2.5 py-1 rounded-xl transition border border-zinc-700">Salir</button>
        </div>
    ` : `
        <button onclick="loginGoogle()" class="flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow active:scale-95">
            <svg class="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Acceder</span>
        </button>
    `;

    if (authContainerDesktop) authContainerDesktop.innerHTML = authHtml;
    if (authContainerMobile) authContainerMobile.innerHTML = authHtml;
}

window.loginGoogle = async function() {
    try {
        await auth.signInWithPopup(googleProvider);
    } catch (e) {
        console.error("Error iniciando sesión con Google:", e);
    }
};

window.logoutGoogle = async function() {
    try {
        await auth.signOut();
    } catch (e) {
        console.error("Error al salir:", e);
    }
};

// SINCRONIZACIÓN CON FIRESTORE
async function loadUserDataFromCloud(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            myFavorites = data.favorites || [];
            myWatchlistItems = data.watchlist || [];
            localStorage.setItem('fernando_favorites', JSON.stringify(myFavorites));
            localStorage.setItem('fernando_watchlist', JSON.stringify(myWatchlistItems));
        } else {
            await syncToCloud();
        }
    } catch (err) {
        console.error("Error cargando datos de Firestore:", err);
    }
}

async function syncToCloud() {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).set({
            favorites: myFavorites,
            watchlist: myWatchlistItems,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.error("Error guardando en Firestore:", err);
    }
}

// --- NAVEGACIÓN ENTRE VISTAS ---
window.switchView = function(viewName) {
    viewFeed.classList.add('hidden');
    viewWatchlist.classList.add('hidden');
    viewFavorites.classList.add('hidden');

    const activeNav = "px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer bg-white text-zinc-950 shadow-md";
    const inactiveNav = "px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer text-zinc-400 hover:text-white";

    navFeed.className = `flex-1 sm:flex-initial ${viewName === 'feed' ? activeNav : inactiveNav}`;
    navWatchlist.className = `flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${viewName === 'watchlist' ? activeNav : inactiveNav}`;
    navFavorites.className = `flex-1 sm:flex-initial flex items-center justify-center gap-1.5 ${viewName === 'favorites' ? activeNav : inactiveNav}`;

    if (viewName === 'feed') {
        viewFeed.classList.remove('hidden');
    } else if (viewName === 'watchlist') {
        viewWatchlist.classList.remove('hidden');
        renderWatchlistCatalog();
    } else if (viewName === 'favorites') {
        viewFavorites.classList.remove('hidden');
        renderFavoritesCatalog();
    }
};

function updateBadges() {
    if (badgeWatchlist) badgeWatchlist.textContent = myWatchlistItems.length;
    if (badgeFavorites) badgeFavorites.textContent = myFavorites.length;
}

// BUSCADOR EN VISTA FAVORITAS
let favSearchTimeout;
favSearchInput.addEventListener('input', (e) => {
    clearTimeout(favSearchTimeout);
    const q = e.target.value.trim();
    if (!q) {
        favSuggestions.classList.add('hidden');
        return;
    }

    favSearchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(q)}`);
            const data = await res.json();
            const results = (data.results || []).filter(i => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 6);

            if (results.length === 0) {
                favSuggestions.innerHTML = '<div class="p-3 text-xs text-zinc-500">No se encontraron coincidencias.</div>';
            } else {
                favSuggestions.innerHTML = results.map(item => {
                    const title = item.title || item.name;
                    const type = item.media_type;
                    const year = (item.release_date || item.first_air_date || '').split('-')[0];
                    const poster = item.poster_path ? `${IMG_URL}${item.poster_path}` : '';
                    const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safePoster = (item.poster_path || '').replace(/'/g, "\\'");

                    return `
                        <div class="p-2.5 hover:bg-zinc-900 cursor-pointer text-xs flex items-center justify-between border-b border-zinc-900/50 transition gap-2" onclick="addFavorite(${item.id}, '${type}', '${safeTitle}', '${safePoster}', '${year}')">
                            <div class="flex items-center gap-2.5 min-w-0">
                                ${poster ? `<img src="${poster}" class="w-7 h-10 object-cover rounded flex-shrink-0">` : `<div class="w-7 h-10 bg-zinc-800 rounded flex-shrink-0"></div>`}
                                <div class="truncate">
                                    <div class="font-bold text-zinc-100 truncate">${title}</div>
                                    <div class="text-[10px] text-zinc-500">${year || 'N/A'} • ${type === 'tv' ? 'Serie' : 'Película'}</div>
                                </div>
                            </div>
                            <span class="text-red-500 font-bold whitespace-nowrap text-xs">+ Agregar</span>
                        </div>
                    `;
                }).join('');
            }
            favSuggestions.classList.remove('hidden');
        } catch (err) {
            console.error(err);
        }
    }, 250);
});

document.addEventListener('click', (e) => {
    if (favSearchInput && favSuggestions && !favSearchInput.contains(e.target) && !favSuggestions.contains(e.target)) {
        favSuggestions.classList.add('hidden');
    }
});

// GESTIÓN DE FAVORITAS (YA VISTAS)
window.addFavorite = function(id, type, title, poster_path = '', release_date = '') {
    if (myFavorites.some(f => f.id === id && f.type === type)) {
        favSearchInput.value = '';
        favSuggestions.classList.add('hidden');
        return;
    }
    myFavorites.unshift({ id, type, title, poster_path, release_date });
    localStorage.setItem('fernando_favorites', JSON.stringify(myFavorites));
    syncToCloud();

    removeWatchlist(id, type, false);

    favSearchInput.value = '';
    favSuggestions.classList.add('hidden');
    updateBadges();
    renderFavoritesCatalog();
    generateSmartRecommendations();
};

window.removeFavorite = function(id, type) {
    myFavorites = myFavorites.filter(f => !(f.id === id && f.type === type));
    localStorage.setItem('fernando_favorites', JSON.stringify(myFavorites));
    syncToCloud();

    updateBadges();
    renderFavoritesCatalog();
    if (myFavorites.length > 0) {
        generateSmartRecommendations();
    } else {
        allLoadedRecommendations = [];
        genresBar.innerHTML = '';
        recommendationsContainer.innerHTML = '<p class="text-center text-zinc-500 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4 text-xs sm:text-sm">Ve a la pestaña <strong>Favoritas</strong> para registrar lo que ya viste y generar tus sugerencias personalizadas.</p>';
    }
};

function renderFavoritesCatalog() {
    if (myFavorites.length === 0) {
        favoritesGrid.innerHTML = `
            <div class="col-span-full text-center py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">
                <p class="text-zinc-400 text-sm font-semibold">No tienes películas o series registradas aún.</p>
                <p class="text-zinc-500 text-xs mt-1">Usa el buscador de arriba para agregar tus preferidas.</p>
            </div>
        `;
        return;
    }

    favoritesGrid.innerHTML = myFavorites.map(fav => {
        const poster = fav.poster_path 
            ? (fav.poster_path.startsWith('http') ? fav.poster_path : `${IMG_URL}${fav.poster_path}`)
            : 'https://via.placeholder.com/500x750?text=Sin+Imagen';

        const typeBadge = fav.type === 'tv' 
            ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded">Serie</span>' 
            : '<span class="text-[10px] font-bold text-amber-500 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded">Película</span>';

        return `
            <div class="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex flex-col group relative">
                <div class="relative overflow-hidden aspect-[2/3] cursor-pointer" onclick="fetchMediaDetails(${fav.id}, '${fav.type}')">
                    <img src="${poster}" alt="${fav.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <button type="button" onclick="event.stopPropagation(); removeFavorite(${fav.id}, '${fav.type}')" 
                        class="absolute top-2 right-2 bg-black/75 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition shadow-lg" title="Quitar de favoritas">
                        &times;
                    </button>
                </div>
                <div class="p-3 flex flex-col flex-grow justify-between gap-1.5">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        ${typeBadge}
                        <h4 class="font-bold text-xs text-zinc-100 truncate">${fav.title}</h4>
                    </div>
                    <p class="text-[11px] text-zinc-500">${fav.release_date || ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

// GESTIÓN DE WATCHLIST ("POR VER")
window.addToWatchlist = function(id, type, title, poster_path = '', release_date = '', event) {
    if (event) event.stopPropagation();
    if (myWatchlistItems.some(w => w.id === id && w.type === type)) return;

    myWatchlistItems.unshift({ id, type, title, poster_path, release_date });
    localStorage.setItem('fernando_watchlist', JSON.stringify(myWatchlistItems));
    syncToCloud();

    updateBadges();
    renderFilteredFeed();
    if (!viewWatchlist.classList.contains('hidden')) {
        renderWatchlistCatalog();
    }
};

window.removeWatchlist = function(id, type, shouldRender = true) {
    myWatchlistItems = myWatchlistItems.filter(w => !(w.id === id && w.type === type));
    localStorage.setItem('fernando_watchlist', JSON.stringify(myWatchlistItems));
    syncToCloud();

    updateBadges();
    if (shouldRender) {
        renderFilteredFeed();
        renderWatchlistCatalog();
    }
};

window.markAsWatched = function(id, type, title, poster_path, release_date, event) {
    if (event) event.stopPropagation();
    addFavorite(id, type, title, poster_path, release_date);
    removeWatchlist(id, type);
};

function renderWatchlistCatalog() {
    if (myWatchlistItems.length === 0) {
        watchlistGrid.innerHTML = `
            <div class="col-span-full text-center py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900 px-4">
                <p class="text-zinc-400 text-sm font-semibold">Tu lista de pendientes está vacía.</p>
                <p class="text-zinc-500 text-xs mt-1">Explora las recomendaciones y pulsa "+ Por ver" en las que quieras comenzar.</p>
            </div>
        `;
        return;
    }

    watchlistGrid.innerHTML = myWatchlistItems.map(item => {
        const poster = item.poster_path 
            ? (item.poster_path.startsWith('http') ? item.poster_path : `${IMG_URL}${item.poster_path}`)
            : 'https://via.placeholder.com/500x750?text=Sin+Imagen';

        const safeTitle = item.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safePoster = (item.poster_path || '').replace(/'/g, "\\'");

        const typeBadge = item.type === 'tv' 
            ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded">Serie</span>' 
            : '<span class="text-[10px] font-bold text-amber-500 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded">Película</span>';

        return `
            <div class="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex flex-col group relative">
                <div class="relative overflow-hidden aspect-[2/3] cursor-pointer" onclick="fetchMediaDetails(${item.id}, '${item.type}')">
                    <img src="${poster}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    <button type="button" onclick="event.stopPropagation(); removeWatchlist(${item.id}, '${item.type}')" 
                        class="absolute top-2 right-2 bg-black/75 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition shadow-lg" title="Quitar de la lista">
                        &times;
                    </button>
                </div>
                <div class="p-3 flex flex-col flex-grow justify-between gap-2.5">
                    <div>
                        <div class="flex items-center gap-1.5 overflow-hidden">
                            ${typeBadge}
                            <h4 class="font-bold text-xs text-zinc-100 truncate">${item.title}</h4>
                        </div>
                        <p class="text-[11px] text-zinc-500 mt-0.5">${item.release_date || ''}</p>
                    </div>

                    <button type="button" onclick="markAsWatched(${item.id}, '${item.type}', '${safeTitle}', '${safePoster}', '${item.release_date || ''}', event)"
                        class="w-full bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/70 text-emerald-300 font-bold text-[11px] py-1.5 rounded-lg transition flex items-center justify-center gap-1 shadow">
                        <span>✔ Ya la vi</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// FILTROS EN FEED
window.setTypeFilter = function(type) {
    currentTypeFilter = type;
    currentGenreFilter = 'all';

    const btnAll = document.getElementById('filterAll');
    const btnTv = document.getElementById('filterTv');
    const btnMovie = document.getElementById('filterMovie');

    const baseClass = "flex-1 py-2 px-3 rounded-xl font-bold text-xs border transition active:scale-95 cursor-pointer";
    const inactiveClass = `${baseClass} bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700`;

    btnAll.className = type === 'all' 
        ? `${baseClass} bg-white text-zinc-950 border-white shadow-md` 
        : inactiveClass;

    btnTv.className = type === 'tv' 
        ? `${baseClass} bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/50` 
        : inactiveClass;

    btnMovie.className = type === 'movie' 
        ? `${baseClass} bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/50` 
        : inactiveClass;

    updateGenresBar();
    renderFilteredFeed();
};

window.setGenreFilter = function(genreName) {
    currentGenreFilter = genreName;
    updateGenresBar();
    renderFilteredFeed();
};

function updateGenresBar() {
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
        <button onclick="setGenreFilter('all')" class="px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${currentGenreFilter === 'all' ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}">
            Todos los géneros
        </button>
    `;

    genresList.forEach(genre => {
        const isSelected = currentGenreFilter === genre;
        html += `
            <button onclick="setGenreFilter('${genre}')" class="px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${isSelected ? 'bg-white text-zinc-950 border-white' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}">
                ${genre}
            </button>
        `;
    });

    genresBar.innerHTML = html;
}

// OBTENER RECOMENDACIONES DE TMDB
async function generateSmartRecommendations() {
    if (myFavorites.length === 0) return;
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
        console.error("Error:", error);
        recommendationsContainer.innerHTML = '<p class="text-center text-red-400 py-20 bg-zinc-900/30 rounded-2xl border border-zinc-900">Ocurrió un error al calcular tus recomendaciones.</p>';
    }
}

function renderFilteredFeed() {
    let filtered = allLoadedRecommendations;

    if (currentTypeFilter !== 'all') {
        filtered = filtered.filter(item => item.media_type === currentTypeFilter);
    }

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

    let groupedByGenre = {};
    filtered.forEach(item => {
        const genreIds = item.genre_ids || [];
        genreIds.forEach(gId => {
            const genreName = genreMap.get(gId) || 'Otros';
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

function displayMediaCards(items, container) {
    container.innerHTML = '';
    items.forEach(item => {
        const { id, title, name, poster_path, vote_average, release_date, first_air_date, media_type } = item;
        const mediaTitle = title || name;
        const date = (release_date || first_air_date || '').split('-')[0];
        const poster = poster_path ? `${IMG_URL}${poster_path}` : 'https://via.placeholder.com/500x750?text=Sin+Imagen';
        const realType = media_type || (title ? 'movie' : 'tv');

        const isSaved = myWatchlistItems.some(w => w.id === id && w.type === realType);
        const safeTitle = mediaTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safePoster = (poster_path || '').replace(/'/g, "\\'");

        const typeBadge = realType === 'tv' 
            ? '<span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">Serie</span>' 
            : '<span class="text-[10px] font-bold text-amber-500 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">Película</span>';

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${mediaTitle}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
                
                <button type="button" onclick="${isSaved ? `removeWatchlist(${id}, '${realType}', true)` : `addToWatchlist(${id}, '${realType}', '${safeTitle}', '${safePoster}', '${date}', event)`}" 
                    class="absolute bottom-2 right-2 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md border transition ${isSaved ? 'bg-red-600 text-white border-red-500' : 'bg-black/75 text-zinc-300 border-zinc-700 hover:border-white'}">
                    ${isSaved ? '✓ En lista' : '+ Por ver'}
                </button>
            </div>
            <div class="p-3 flex flex-col flex-grow justify-between gap-1.5">
                <div class="flex items-center gap-1.5 overflow-hidden">
                    ${typeBadge}
                    <h4 class="font-bold text-xs text-zinc-100 truncate">${mediaTitle}</h4>
                </div>
                <p class="text-[11px] text-zinc-500">${date}</p>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'button') return;
            fetchMediaDetails(id, realType);
        });
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
    const year = (movie.release_date || '').split('-')[0];

    const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer espanol latino')}`;
    const reviewSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' critica reseña')}`;
    const isSaved = myWatchlistItems.some(w => w.id === movie.id && w.type === 'movie');
    const safeTitle = movie.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safePoster = (movie.poster_path || '').replace(/'/g, "\\'");

    modalBody.innerHTML = `
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <div class="relative z-10 space-y-1">
                <span class="text-[10px] font-bold text-amber-500 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded uppercase">Película</span>
                <h2 class="text-xl sm:text-2xl font-black text-white drop-shadow-md">${movie.title}</h2>
            </div>
        </div>

        <div class="space-y-5 text-sm text-zinc-300">
            <div class="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <div class="flex items-center gap-3">
                    <span class="text-xl">⭐</span>
                    <div>
                        <div class="text-sm font-bold text-white">${rating} / 10 <span class="text-xs font-normal text-zinc-400">público</span></div>
                        <div class="text-[11px] text-zinc-500">${voteCount} votos</div>
                    </div>
                </div>
                <button type="button" onclick="${isSaved ? `removeWatchlist(${movie.id}, 'movie', true)` : `addToWatchlist(${movie.id}, 'movie', '${safeTitle}', '${safePoster}', '${year}')`}; showMovieModal(${JSON.stringify(movie).replace(/"/g, '&quot;')}, ${JSON.stringify(providers).replace(/"/g, '&quot;')});" 
                    class="px-3 py-2 rounded-xl text-xs font-bold transition border ${isSaved ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'}">
                    ${isSaved ? '✓ En lista Por Ver' : '+ Agregar a Por Ver'}
                </button>
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
    const year = (tv.first_air_date || '').split('-')[0];

    let seasonsHtml = tv.seasons.filter(s => s.season_number > 0).map(s => `<option value="${s.season_number}">Temporada ${s.season_number} (${s.episode_count} eps)</option>`).join('');

    const reviewSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' critica serie resena')}`;
    const isSaved = myWatchlistItems.some(w => w.id === tv.id && w.type === 'tv');
    const safeTitle = tv.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safePoster = (tv.poster_path || '').replace(/'/g, "\\'");

    modalBody.innerHTML = `
        <div class="relative h-56 sm:h-72 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 bg-cover bg-center flex items-end p-4 sm:p-6" style="background-image: url('${backdrop}');">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent"></div>
            <div class="relative z-10 space-y-1">
                <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded uppercase">Serie</span>
                <h2 class="text-xl sm:text-2xl font-black text-white drop-shadow-md">${tv.name}</h2>
            </div>
        </div>

        <div class="space-y-5 text-sm text-zinc-300">
            <div class="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <div class="flex items-center gap-3">
                    <span class="text-xl">⭐</span>
                    <div>
                        <div class="text-sm font-bold text-white">${rating} / 10 <span class="text-xs font-normal text-zinc-400">público</span></div>
                        <div class="text-[11px] text-zinc-500">${voteCount} votos</div>
                    </div>
                </div>
                <button type="button" onclick="${isSaved ? `removeWatchlist(${tv.id}, 'tv', true)` : `addToWatchlist(${tv.id}, 'tv', '${safeTitle}', '${safePoster}', '${year}')`}; showTvModal(${JSON.stringify(tv).replace(/"/g, '&quot;')}, ${JSON.stringify(providers).replace(/"/g, '&quot;')});" 
                    class="px-3 py-2 rounded-xl text-xs font-bold transition border ${isSaved ? 'bg-red-600 text-white border-red-500' : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'}">
                    ${isSaved ? '✓ En lista Por Ver' : '+ Agregar a Por Ver'}
                </button>
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

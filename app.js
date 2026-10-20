const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const sectionTitle = document.getElementById('sectionTitle');
const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Obtener la API Key guardada en el navegador
let API_KEY = localStorage.getItem('tmdb_api_key') || '';

if (API_KEY) {
    apiKeyInput.value = API_KEY;
    fetchTrendingMovies();
} else {
    moviesGrid.innerHTML = '<p class="text-amber-400 col-span-full text-center py-10">Por favor, ingresa y guarda tu TMDB API Key en la esquina superior derecha para cargar el catálogo.</p>';
}

// Guardar API Key al hacer clic en el botón
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('tmdb_api_key', key);
        API_KEY = key;
        alert('¡API Key guardada correctamente!');
        fetchTrendingMovies();
    } else {
        alert('Por favor, introduce una clave válida.');
    }
});

// Cargar películas populares
async function fetchTrendingMovies() {
    if (!API_KEY) return;
    try {
        const response = await fetch(`${BASE_URL}/trending/movie/day?api_key=${API_KEY}&language=es-ES`);
        const data = await response.json();
        if (data.success === false) {
            moviesGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: ${data.status_message}</p>`;
            return;
        }
        displayMovies(data.results);
    } catch (error) {
        console.error("Error al obtener tendencias:", error);
    }
}

// Buscar películas en tiempo real
async function searchMovies(query) {
    if (!API_KEY) {
        alert('Primero debes configurar tu API Key.');
        return;
    }

    if (!query.trim()) {
        sectionTitle.textContent = "Tendencias Populares";
        fetchTrendingMovies();
        return;
    }

    sectionTitle.textContent = `Resultados para: "${query}"`;
    try {
        const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&language=es-ES&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        displayMovies(data.results);
    } catch (error) {
        console.error("Error en la búsqueda:", error);
    }
}

// Pintar tarjetas
function displayMovies(movies) {
    moviesGrid.innerHTML = '';

    if (!movies || movies.length === 0) {
        moviesGrid.innerHTML = '<p class="text-zinc-400 col-span-full text-center py-10">No se encontraron resultados.</p>';
        return;
    }

    movies.forEach(movie => {
        const { id, title, poster_path, vote_average, release_date } = movie;
        const poster = poster_path ? `${IMG_URL}${poster_path}` : 'https://via.placeholder.com/500x750?text=Sin+Imagen';

        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-red-600 transition cursor-pointer flex flex-col group';
        
        card.innerHTML = `
            <div class="relative overflow-hidden aspect-[2/3]">
                <img src="${poster}" alt="${title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                <span class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs font-bold px-2 py-1 rounded text-amber-400">⭐ ${vote_average ? vote_average.toFixed(1) : 'N/A'}</span>
            </div>
            <div class="p-4 flex flex-col flex-grow justify-between">
                <h3 class="font-bold text-sm text-zinc-100 truncate">${title}</h3>
                <p class="text-xs text-zinc-500 mt-1">${release_date ? release_date.split('-')[0] : 'Próximamente'}</p>
            </div>
        `;

        card.addEventListener('click', () => fetchMovieDetails(id));
        moviesGrid.appendChild(card);
    });
}

// Obtener detalles y trailer
async function fetchMovieDetails(movieId) {
    try {
        const resMovie = await fetch(`${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=es-ES`);
        const movie = await resMovie.json();

        const resVideos = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`);
        const videoData = await resVideos.json();
        const trailer = videoData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');

        showModal(movie, trailer ? trailer.key : null);
    } catch (error) {
        console.error("Error al cargar detalles:", error);
    }
}

// Mostrar Modal
function showModal(movie, trailerKey) {
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

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchMovies(e.target.value);
    }, 400);
});

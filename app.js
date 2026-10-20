// CONTROL DE FILTRO: TODO (Blanco) / SERIES (Verde) / PELÍCULAS (Naranja)
window.setTypeFilter = function(type) {
    currentTypeFilter = type;
    currentGenreFilter = 'all';

    const btnAll = document.getElementById('filterAll');
    const btnTv = document.getElementById('filterTv');
    const btnMovie = document.getElementById('filterMovie');

    const baseClass = "flex-1 py-2 px-3 rounded-xl font-bold text-xs border transition active:scale-95 cursor-pointer";
    const inactiveClass = `${baseClass} bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700`;

    // Blanco para 'Todo', Verde para 'Series', Naranja para 'Películas'
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

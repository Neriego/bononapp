/**
 * BononaMovie - App de Películas para Ger & Magui
 * Sistema de ranking compartido con Firebase
 * Powered by TMDB API
 */

// ===== API Configuration =====
const API_CONFIG = {
    baseUrl: 'https://api.themoviedb.org/3',
    apiKey: 'c873a17711bf8960e3754a794af4cf96',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
    language: 'es-ES'
};

// ===== State =====
let currentUser = null;
let rankingData = [];
let moviesCache = {};
let actorsCache = {};
let currentRankingFilter = 'all';

// ===== Firebase References =====
const rankingRef = window.db ? window.db.ref('ranking') : null;
const votesRef = window.db ? window.db.ref('votes') : null;

// ===== DOM Elements =====
const elements = {
    loginModal: document.getElementById('loginModal'),
    mainApp: document.getElementById('mainApp'),
    homeView: document.getElementById('homeView'),
    searchView: document.getElementById('searchView'),
    rankingView: document.getElementById('rankingView'),
    movieDetailView: document.getElementById('movieDetailView'),
    wishlistView: document.getElementById('wishlistView'),
    profileView: document.getElementById('profileView'),
    heroContent: document.getElementById('heroContent'),
    rankingCarousel: document.getElementById('rankingCarousel'),
    favoritosCarousel: document.getElementById('favoritosCarousel'),
    favoritosTitle: document.getElementById('favoritosTitle'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    rankingGrid: document.getElementById('rankingGrid'),
    wishlistGrid: document.getElementById('wishlistGrid'),
    wishlistGrid: document.getElementById('wishlistGrid'),
    movieDetailContent: document.getElementById('movieDetailContent'),
    actorDetailView: document.getElementById('actorDetailView')
};

// ===== Utility Functions =====

function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return `${now.getFullYear()}-W${Math.floor(diff / oneWeek).toString().padStart(2, '0')}`;
}

function getOtherUser() {
    return currentUser === 'Ger' ? 'Magui' : 'Ger';
}

// ===== Authentication =====

function login(username) {
    currentUser = username;
    localStorage.setItem('bononaUser', username);
    initializeUserVotes(username);
    elements.loginModal.classList.add('hidden');
    elements.mainApp.classList.remove('hidden');
    setupFirebaseListeners();
    showHomeView();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('bononaUser');
    elements.loginModal.classList.remove('hidden');
    elements.mainApp.classList.add('hidden');
}

function checkAuth() {
    const user = localStorage.getItem('bononaUser');
    if (user) {
        currentUser = user;
        elements.loginModal.classList.add('hidden');
        elements.mainApp.classList.remove('hidden');
        setupFirebaseListeners();
        // Allow a small delay for initial renders or keep loader until data? 
        // For now, hiding it here prevents the "flash" of the login modal.
        showHomeView();
    }

    // Always hide loader after determining state
    setTimeout(() => {
        toggleLoader(false);
    }, 500); // Pequeño delay para suavizar la transición
}

async function initializeUserVotes(username) {
    if (!votesRef) return;
    const currentWeek = getCurrentWeek();
    const snapshot = await votesRef.child(username).once('value');
    const data = snapshot.val();

    if (!data || data.week !== currentWeek) {
        await votesRef.child(username).set({ week: currentWeek, remaining: 5 });
    }
}

// ===== Firebase Listeners =====

function setupFirebaseListeners() {
    if (!rankingRef) return;

    rankingRef.on('value', (snapshot) => {
        const data = snapshot.val();
        rankingData = data ? Object.values(data) : [];
        rankingData.sort((a, b) => (b.votes || 0) - (a.votes || 0));

        updateHomeView();

        if (document.getElementById('rankingView').classList.contains('hidden') === false) {
            renderRankingGrid();
        }
    });

    // Listen for user votes changes
    if (votesRef && currentUser) {
        votesRef.child(currentUser).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateVotesChip(data.remaining || 0);
            }
        });
    }
}

function updateVotesChip(remaining) {
    const chip = document.getElementById('votesChipCount');
    if (chip) {
        chip.textContent = `${remaining} votos`;
    }
}

// ===== Navigation =====

window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state) {
        restoreView(state);
    } else {
        showHomeView(false);
    }
});

function navigateBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        showHomeView(true);
    }
}

function restoreView(state) {
    switch (state.view) {
        case 'search': showSearchView(false); break;
        case 'ranking': showRankingView(false); break;
        case 'wishlist': showWishlistView(false); break;
        case 'wishlist': showWishlistView(false); break;
        case 'profile': showProfileView(false); break;
        case 'movie': showMovieDetail(state.movieId, false); break;
        case 'actor': showActorDetail(state.personId, false); break;
        default: showHomeView(false);
    }
}

function hideAllViews() {
    elements.homeView.classList.add('hidden');
    elements.searchView.classList.add('hidden');
    elements.rankingView.classList.add('hidden');
    elements.movieDetailView.classList.add('hidden');
    elements.wishlistView.classList.add('hidden');
    elements.profileView.classList.add('hidden');
    elements.actorDetailView.classList.add('hidden');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('text-accent-yellow');
        item.classList.add('text-white');
    });
}

function showHomeView(pushState = true) {
    if (pushState) history.pushState({ view: 'home' }, '', '#home');
    hideAllViews();
    elements.homeView.classList.remove('hidden');
    document.getElementById('navHome').classList.remove('text-white');
    document.getElementById('navHome').classList.add('text-accent-yellow');
    document.getElementById('votesChip').classList.remove('hidden'); // Show votes chip
    updateHomeView();
}

function showSearchView(pushState = true) {
    if (pushState) history.pushState({ view: 'search' }, '', '#search');
    hideAllViews();
    elements.searchView.classList.remove('hidden');
    document.getElementById('navSearch').classList.remove('text-white');
    document.getElementById('navSearch').classList.add('text-accent-yellow');
    document.getElementById('votesChip').classList.add('hidden'); // Hide votes chip
}

function hideSearchView() {
    navigateBack();
}

function showRankingView(pushState = true) {
    if (pushState) history.pushState({ view: 'ranking' }, '', '#ranking');
    hideAllViews();
    elements.rankingView.classList.remove('hidden');
    document.getElementById('navRanking').classList.remove('text-white');
    document.getElementById('navRanking').classList.add('text-accent-yellow');
    document.getElementById('votesChip').classList.remove('hidden'); // Show votes chip
    renderRankingGrid();
}

function hideRankingView() {
    navigateBack();
}

function showWishlistView(pushState = true) {
    if (pushState) history.pushState({ view: 'wishlist' }, '', '#wishlist');
    hideAllViews();
    elements.wishlistView.classList.remove('hidden');
    // Nav item removed from bottom bar
    // document.getElementById('navWishlist').classList.remove('text-white');
    // document.getElementById('navWishlist').classList.add('text-accent-yellow');
    document.getElementById('votesChip').classList.remove('hidden'); // Show votes chip
    renderWishlistGrid();
}

function showProfileView(pushState = true) {
    if (pushState) history.pushState({ view: 'profile' }, '', '#profile');
    hideAllViews();
    elements.profileView.classList.remove('hidden');
    document.getElementById('navProfile').classList.remove('text-white');
    document.getElementById('navProfile').classList.add('text-accent-yellow');
    document.getElementById('votesChip').classList.remove('hidden'); // Show votes chip
    updateProfileView();
}

function showMovieDetail(movieId, pushState = true) {
    if (pushState) history.pushState({ view: 'movie', movieId }, '', `#movie-${movieId}`);
    hideAllViews();
    elements.movieDetailView.classList.remove('hidden');
    document.getElementById('votesChip').classList.remove('hidden'); // Show votes chip
    loadMovieDetail(movieId);
}

function showOtherUserFavorites() {
    hideAllViews();
    elements.rankingView.classList.remove('hidden');

    const otherUser = getOtherUser();
    const otherUserMovies = rankingData.filter(m => m.addedBy === otherUser);

    document.querySelector('#rankingView h1').textContent = `💜 Agregadas por ${otherUser}`;
    elements.rankingGrid.innerHTML = otherUserMovies.length > 0
        ? otherUserMovies.map((m, i) => createMovieCard(m, i + 1)).join('')
        : '<p class="col-span-2 text-center text-gray-500 py-8">Todavía no agregó películas</p>';
}

// ===== Home View =====

async function updateHomeView() {
    renderHeroSection();
    renderRankingCarousel();
    renderFavoritosCarousel();
}

async function renderHeroSection() {
    const topMovie = rankingData[0];

    if (topMovie) {
        const backdropUrl = topMovie.poster_path
            ? `${API_CONFIG.imageBaseUrl}/w780${topMovie.poster_path}`
            : null;

        elements.heroContent.innerHTML = `
            <div class="relative h-[65vh] min-h-[500px]">
                ${backdropUrl ? `
                    <img src="${backdropUrl}" alt="${topMovie.title}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/80 to-transparent"></div>
                ` : `
                    <div class="w-full h-full bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center">
                        <span class="text-6xl">🎬</span>
                    </div>
                `}
        <div class="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-dark-900 to-transparent pt-32">
            <div class="flex flex-col items-center text-center">
                <p class="text-sm text-accent-yellow mb-2 font-medium tracking-wide">🏆 #1 EN EL RANKING</p>
                <h2 class="text-4xl font-bold mb-2 text-white leading-tight">${topMovie.title}</h2>
                <p class="text-gray-300 text-sm mb-6">${topMovie.votes || 0} votos</p>

                <div class="flex gap-3 w-full max-w-md">
                    <button onclick="showMovieDetail(${topMovie.id})" class="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl font-medium text-white hover:bg-white/20 transition-colors">
                        <span class="text-lg">ℹ️</span> Información
                            </button>
                            <button onclick="showRankingView()" class="flex-1 py-3.5 bg-accent-yellow text-dark-900 rounded-xl font-bold hover:bg-accent-yellow/90 transition-colors">
                                Ver ranking
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Empty state - fetch a popular movie
        try {
            const data = await fetchFromTMDB('/movie/popular');
            const randomMovie = data.results[Math.floor(Math.random() * 5)];
            const backdropUrl = randomMovie.backdrop_path
                ? `${API_CONFIG.imageBaseUrl}/w780${randomMovie.backdrop_path}`
                : null;

            elements.heroContent.innerHTML = `
                <div class="relative h-[65vh] min-h-[500px]">
                    ${backdropUrl ? `
                        <img src="${backdropUrl}" alt="${randomMovie.title}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/80 to-transparent"></div>
                    ` : ''}
                    <div class="absolute bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-dark-900 to-transparent pt-32 flex flex-col items-center justify-center text-center">
                        <div class="text-6xl mb-4">🎬</div>
                        <h2 class="text-3xl font-bold mb-3 text-white">¡Empezá a agregar películas!</h2>
                        <p class="text-gray-300 text-lg mb-8 max-w-xs mx-auto">Buscá tus favoritas y sumalas al ranking compartido</p>
                        <button onclick="showSearchView()" class="px-8 py-4 bg-accent-yellow text-dark-900 rounded-xl font-bold text-lg hover:bg-accent-yellow/90 transition-colors shadow-lg shadow-accent-yellow/20">
                            🔍 Buscar películas
                        </button>
                    </div>
                </div>
            `;
        } catch (e) {
            elements.heroContent.innerHTML = `
                <div class="h-[65vh] min-h-[500px] flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-dark-800 to-dark-900 border-b border-white/5">
                    <div class="text-6xl mb-4">🎬</div>
                    <h2 class="text-3xl font-bold mb-3 text-white">¡Empezá a agregar películas!</h2>
                    <p class="text-gray-400 text-lg mb-8 max-w-xs mx-auto">Conectate y buscá tus favoritas para el ranking</p>
                    <button onclick="showSearchView()" class="px-8 py-4 bg-accent-yellow text-dark-900 rounded-xl font-bold text-lg hover:bg-accent-yellow/90 transition-colors shadow-lg shadow-accent-yellow/20">
                        🔍 Buscar películas
                    </button>
                </div>
            `;
        }
    }
}

function renderRankingCarousel() {
    if (rankingData.length === 0) {
        elements.rankingCarousel.innerHTML = `
            <div class="flex-shrink-0 w-32 h-48 bg-dark-700 rounded-xl flex items-center justify-center">
                <span class="text-gray-500 text-sm text-center px-2">Sin películas</span>
            </div>
        `;
        return;
    }

    elements.rankingCarousel.innerHTML = rankingData.slice(0, 10).map((movie, index) => `
        <div class="flex-shrink-0 w-32 cursor-pointer" onclick="showMovieDetail(${movie.id})">
            <div class="relative">
                ${movie.poster_path
            ? `<img src="${API_CONFIG.imageBaseUrl}/w200${movie.poster_path}" alt="${movie.title}" class="w-full h-48 object-cover rounded-xl">`
            : `<div class="w-full h-48 bg-dark-700 rounded-xl flex items-center justify-center text-3xl">🎬</div>`
        }
                <div class="absolute top-2 left-2 w-6 h-6 bg-accent-yellow text-dark-900 rounded-full flex items-center justify-center text-xs font-bold">
                    ${index + 1}
                </div>
            </div>
            <p class="mt-2 text-sm font-medium truncate">${movie.title}</p>
        </div>
    `).join('');
}

function renderFavoritosCarousel() {
    const otherUser = getOtherUser();
    elements.favoritosTitle.textContent = `Favoritos de ${otherUser}`;
    document.getElementById('verFavoritosBtn').textContent = `Ver listado ${otherUser}`;

    const otherUserMovies = rankingData.filter(m => m.addedBy === otherUser);

    if (otherUserMovies.length === 0) {
        elements.favoritosCarousel.innerHTML = `
            <div class="flex-shrink-0 w-32 h-48 bg-dark-700 rounded-xl flex items-center justify-center">
                <span class="text-gray-500 text-sm text-center px-2">${otherUser} no agregó películas</span>
            </div>
        `;
        return;
    }

    elements.favoritosCarousel.innerHTML = otherUserMovies.slice(0, 10).map(movie => `
        <div class="flex-shrink-0 w-32 cursor-pointer" onclick="showMovieDetail(${movie.id})">
            <div class="relative">
                ${movie.poster_path
            ? `<img src="${API_CONFIG.imageBaseUrl}/w200${movie.poster_path}" alt="${movie.title}" class="w-full h-48 object-cover rounded-xl">`
            : `<div class="w-full h-48 bg-dark-700 rounded-xl flex items-center justify-center text-3xl">🎬</div>`
        }
                ${movie.vote_average ? `
                    <div class="absolute bottom-2 left-2 px-2 py-0.5 bg-dark-900/80 rounded text-xs flex items-center gap-1">
                        <span class="text-yellow-400">★</span> ${movie.vote_average.toFixed(1)}
                    </div>
                ` : ''}
            </div>
            <p class="mt-2 text-sm font-medium truncate">${movie.title}</p>
        </div>
    `).join('');
}

// ===== Ranking =====

function renderRankingGrid() {
    // Sort by votes (descending)
    let movies = [...rankingData].sort((a, b) => (b.votes || 0) - (a.votes || 0));

    // Filter by user
    if (currentRankingFilter !== 'all') {
        movies = movies.filter(m => m.addedBy === currentRankingFilter);
    }

    const totalVotes = rankingData.reduce((sum, movie) => sum + (movie.votes || 0), 0);
    document.getElementById('rankingTotalVotes').textContent = `${totalVotes} votos totales`;

    if (movies.length === 0) {
        elements.rankingGrid.innerHTML = `
            <div class="col-span-2 text-center py-16">
                <div class="text-6xl mb-4">🎬</div>
                <p class="text-gray-400">No hay películas en el ranking</p>
                <button onclick="showSearchView()" class="mt-4 px-6 py-2 bg-accent-yellow text-dark-900 rounded-xl font-medium">
                    Agregar películas
                </button>
            </div>
        `;
        return;
    }

    elements.rankingGrid.innerHTML = movies.map((movie, index) => createMovieCard(movie, index + 1)).join('');
}

function setRankingFilter(filter) {
    currentRankingFilter = filter;

    // Update UI
    ['all', 'Ger', 'Magui'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (f === filter) {
            btn.className = 'px-3 py-1.5 rounded-full text-xs font-medium bg-white text-dark-900 border border-white transition-colors';
        } else {
            btn.className = 'px-3 py-1.5 rounded-full text-xs font-medium bg-dark-700 text-gray-400 border border-transparent transition-colors';
        }
    });

    renderRankingGrid();
}

function createMovieCard(movie, rank) {
    const userVotes = movie.votedBy?.[currentUser] || 0;

    return `
        <div class="bg-dark-700 rounded-xl overflow-hidden" onclick="showMovieDetail(${movie.id})">
            <div class="relative">
                ${movie.poster_path
            ? `<img src="${API_CONFIG.imageBaseUrl}/w300${movie.poster_path}" alt="${movie.title}" class="w-full h-56 object-cover">`
            : `<div class="w-full h-56 bg-dark-600 flex items-center justify-center text-4xl">🎬</div>`
        }
                <div class="absolute top-2 left-2 w-8 h-8 bg-accent-yellow text-dark-900 rounded-full flex items-center justify-center text-sm font-bold">
                    #${rank}
                </div>
                <div class="absolute top-2 right-2 px-2 py-1 bg-dark-900/80 rounded-lg text-xs flex items-center gap-1">
                    <span class="text-yellow-400">★</span> ${movie.votes || 0}
                </div>
            </div>
            <div class="p-3">
                <h3 class="font-medium truncate mb-2">${movie.title}</h3>
                <button onclick="event.stopPropagation(); voteForMovie(${movie.id})" 
                    class="w-full py-2 ${userVotes > 0 ? 'bg-yellow-400/20 text-yellow-400' : 'bg-accent-purple/20 text-accent-purple'} rounded-lg text-sm font-medium">
                    ${userVotes > 0 ? `⭐ Votada (${userVotes})` : '🗳️ Votar'}
                </button>
            </div>
        </div>
    `;
}

// ===== Wishlist (My Added Movies) =====

function renderWishlistGrid() {
    const myMovies = rankingData.filter(m => m.addedBy === currentUser);

    if (myMovies.length === 0) {
        elements.wishlistGrid.innerHTML = `
            <div class="col-span-2 text-center py-16">
                <div class="text-6xl mb-4">📝</div>
                <p class="text-gray-400">No agregaste películas todavía</p>
                <button onclick="showSearchView()" class="mt-4 px-6 py-2 bg-accent-yellow text-dark-900 rounded-xl font-medium">
                    Buscar películas
                </button>
            </div>
        `;
        return;
    }

    elements.wishlistGrid.innerHTML = myMovies.map((movie, index) => createWishlistMovieCard(movie, index + 1)).join('');
}

function createWishlistMovieCard(movie, rank) {
    const userVotes = movie.votedBy?.[currentUser] || 0;

    return `
        <div class="bg-dark-700 rounded-xl overflow-hidden" onclick="showMovieDetail(${movie.id})">
            <div class="relative">
                ${movie.poster_path
            ? `<img src="${API_CONFIG.imageBaseUrl}/w300${movie.poster_path}" alt="${movie.title}" class="w-full h-56 object-cover">`
            : `<div class="w-full h-56 bg-dark-600 flex items-center justify-center text-4xl">🎬</div>`
        }
                <div class="absolute top-2 left-2 w-8 h-8 bg-accent-yellow text-dark-900 rounded-full flex items-center justify-center text-sm font-bold">
                    #${rank}
                </div>
                <div class="absolute top-2 right-2 px-2 py-1 bg-dark-900/80 rounded-lg text-xs flex items-center gap-1">
                    <span class="text-yellow-400">★</span> ${movie.votes || 0}
                </div>
            </div>
            <div class="p-3">
                <h3 class="font-medium truncate mb-2">${movie.title}</h3>
                <button onclick="event.stopPropagation(); voteForMovie(${movie.id})" 
                    class="w-full py-2 ${userVotes > 0 ? 'bg-gray-600/50 text-gray-400' : 'bg-gray-600 text-white hover:bg-gray-500'} rounded-lg text-sm font-medium transition-colors">
                    ${userVotes > 0 ? '✓ Votada' : 'Votar'}
                </button>
            </div>
        </div>
    `;
}

// ===== Loader =====

function toggleLoader(show) {
    const loader = document.getElementById('loaderOverlay');
    if (show) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

// ===== Movie Detail =====

async function loadMovieDetail(movieId) {
    toggleLoader(true);

    // Clear previous content but keep structure
    elements.movieDetailContent.innerHTML = '';

    try {
        const movie = await fetchFromTMDB(`/movie/${movieId}`, { append_to_response: 'credits' });
        moviesCache[movieId] = movie;
        renderMovieDetail(movie);
    } catch (error) {
        console.error(error);
        elements.movieDetailContent.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center p-4">
                <p class="text-red-400 mb-4">Error al cargar la película</p>
                <button onclick="showHomeView()" class="px-6 py-2 bg-dark-700 rounded-xl">Volver</button>
            </div>
        `;
    } finally {
        toggleLoader(false);
    }
}

function renderMovieDetail(movie) {
    const backdropUrl = movie.backdrop_path
        ? `${API_CONFIG.imageBaseUrl}/w780${movie.backdrop_path}`
        : movie.poster_path
            ? `${API_CONFIG.imageBaseUrl}/w500${movie.poster_path}`
            : null;

    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
    const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
    const genres = movie.genres?.map(g => g.name).join(', ') || '';
    const cast = movie.credits?.cast?.slice(0, 6) || [];
    const isInRanking = rankingData.some(m => m.id === movie.id);
    const rankingMovie = rankingData.find(m => m.id === movie.id);
    const userVotes = rankingMovie?.votedBy?.[currentUser] || 0;

    elements.movieDetailContent.innerHTML = `
        <!-- Back Button -->
        <button onclick="showHomeView()" class="fixed top-4 left-4 z-50 w-10 h-10 bg-dark-900/80 backdrop-blur rounded-full flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
        </button>
        
        <!-- Backdrop -->
        <div class="relative h-[40vh]">
            ${backdropUrl
            ? `<img src="${backdropUrl}" alt="${movie.title}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full bg-gradient-to-br from-dark-700 to-dark-800"></div>`
        }
            <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-dark-900/50 to-transparent"></div>
        </div>
        
        <!-- Content -->
        <div class="relative -mt-20 px-4 pb-24">
            <h1 class="text-3xl font-bold mb-3">${movie.title}</h1>
            
            <!-- Meta Info -->
            <div class="flex flex-wrap gap-2 mb-4">
                ${year ? `<span class="px-3 py-1 bg-dark-700 rounded-lg text-sm">${year}</span>` : ''}
                ${runtime ? `<span class="px-3 py-1 bg-dark-700 rounded-lg text-sm">${runtime}</span>` : ''}
                <span class="px-3 py-1 bg-yellow-400/20 text-yellow-400 rounded-lg text-sm">⭐ ${movie.vote_average?.toFixed(1) || 'N/A'}</span>
            </div>
            
            <!-- Genres -->
            ${genres ? `<p class="text-gray-400 text-sm mb-4">${genres}</p>` : ''}
            
            <!-- Action Buttons -->
            <div class="flex gap-3 mb-6">
                ${isInRanking ? `
                    <div class="flex-1 flex items-center justify-center gap-4 py-3 bg-dark-700 rounded-xl">
                        <button onclick="removeVoteFromMovie(${movie.id})" class="w-10 h-10 bg-red-500/20 text-red-400 rounded-full font-bold text-xl flex items-center justify-center">
                            −
                        </button>
                        <span class="text-xl font-bold text-accent-yellow min-w-[60px] text-center">${rankingMovie?.votes || 0} votos</span>
                        <button onclick="voteForMovie(${movie.id})" class="w-10 h-10 bg-green-500/20 text-green-400 rounded-full font-bold text-xl flex items-center justify-center">
                            +
                        </button>
                    </div>
                    <button onclick="removeFromRanking(${movie.id})" class="px-4 py-3 bg-red-500/20 text-red-400 rounded-xl">
                        🗑️
                    </button>
                ` : `
                    <button onclick="addToRanking(${movie.id})" class="flex-1 py-3 bg-accent-yellow text-dark-900 rounded-xl font-semibold">
                        ➕ Agregar al Ranking
                    </button>
                `}
            </div>
            
            <!-- Overview -->
            <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Sinopsis</h3>
                <p class="text-gray-400 text-sm leading-relaxed">${movie.overview || 'Sin descripción disponible.'}</p>
            </div>
            
            <!-- Cast -->
            ${cast.length > 0 ? `
                <div>
                    <h3 class="text-lg font-semibold mb-3">Reparto</h3>
                    <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        ${cast.map(actor => `
                            <div class="flex-shrink-0 w-20 text-center cursor-pointer" onclick="showActorDetail(${actor.id})">
                                ${actor.profile_path
                ? `<img src="${API_CONFIG.imageBaseUrl}/w185${actor.profile_path}" alt="${actor.name}" class="w-16 h-16 rounded-full object-cover mx-auto mb-2 border border-white/10">`
                : `<div class="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mx-auto mb-2 text-xl border border-white/10">👤</div>`
            }
                                <p class="text-xs font-medium truncate hover:text-accent-purple transition-colors">${actor.name}</p>
                                <p class="text-xs text-gray-500 truncate">${actor.character}</p>
                            </div>
                        `).join('')}
                    </div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// ===== Actor Detail =====

function showActorDetail(personId, pushState = true) {
    if (pushState) history.pushState({ view: 'actor', personId }, '', `#actor-${personId}`);
    hideAllViews();
    elements.actorDetailView.classList.remove('hidden');
    document.getElementById('votesChip').classList.remove('hidden');
    loadActorDetail(personId);
}

async function loadActorDetail(personId) {
    // Check cache
    if (actorsCache[personId] && (Date.now() - actorsCache[personId].timestamp < 1000 * 60 * 60)) {
        renderActorDetail(actorsCache[personId].data);
        return;
    }

    toggleLoader(true);
    elements.actorDetailView.innerHTML = ''; // Clear previous

    try {
        const [person, credits] = await Promise.all([
            fetchFromTMDB(`/person/${personId}`),
            fetchFromTMDB(`/person/${personId}/movie_credits`)
        ]);

        const data = { person, credits };
        actorsCache[personId] = { data, timestamp: Date.now() };
        renderActorDetail(data);

    } catch (error) {
        console.error('Error loading actor:', error);
        elements.actorDetailView.innerHTML = `
            <div class="h-screen flex flex-col items-center justify-center p-4">
                <p class="text-red-400 mb-4">Error al cargar el perfil</p>
                <button onclick="navigateBack()" class="px-6 py-2 bg-dark-700 rounded-xl">Volver</button>
            </div>
        `;
    } finally {
        toggleLoader(false);
    }
}

function renderActorDetail({ person, credits }) {
    const profileUrl = person.profile_path
        ? `${API_CONFIG.imageBaseUrl}/h632${person.profile_path}`
        : null;

    // Filter and sort movies (only released, sorted by date desc)
    const movies = (credits.cast || [])
        .filter(m => m.release_date)
        .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

    // Remove duplicates (sometimes API returns same movie for different roles)
    const uniqueMovies = [];
    const seenIds = new Set();

    for (const movie of movies) {
        if (!seenIds.has(movie.id)) {
            uniqueMovies.push(movie);
            seenIds.add(movie.id);
        }
    }

    elements.actorDetailView.innerHTML = `
        <!-- Header -->
        <div class="sticky top-0 z-40 bg-dark-900/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
            <button onclick="navigateBack()" class="w-10 h-10 flex items-center justify-center -ml-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
            </button>
            <h1 class="text-lg font-bold truncate flex-1">${person.name}</h1>
        </div>

        <div class="p-4">
            <!-- Profile Info -->
            <div class="flex gap-4 mb-6">
                <div class="flex-shrink-0">
                    ${profileUrl
            ? `<img src="${profileUrl}" alt="${person.name}" class="w-28 h-40 object-cover rounded-xl shadow-lg border border-white/10">`
            : `<div class="w-28 h-40 bg-dark-700 rounded-xl flex items-center justify-center text-4xl border border-white/10">👤</div>`
        }
                </div>
                <div class="flex-1 min-w-0 py-1">
                    <h2 class="text-2xl font-bold mb-2 leading-tight">${person.name}</h2>
                    <p class="text-gray-400 text-sm mb-1">Born: ${person.birthday ? new Date(person.birthday).getFullYear() : 'N/A'}</p>
                    <p class="text-gray-400 text-sm mb-3">${person.place_of_birth || ''}</p>
                    <div class="flex flex-wrap gap-2 text-xs">
                        <span class="px-2 py-1 bg-dark-700 rounded-lg">Known for: ${person.known_for_department}</span>
                    </div>
                </div>
            </div>

            <!-- Biography -->
            ${person.biography ? `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold mb-2">Biografía</h3>
                    <p class="text-gray-400 text-sm leading-relaxed max-h-40 overflow-y-auto pr-2 scrollbar-thin">${person.biography}</p>
                </div>
            ` : ''}

            <!-- Filmography -->
            <div>
                <h3 class="text-lg font-semibold mb-3 flex items-center justify-between">
                    Filmografía
                    <span class="text-sm font-normal text-gray-500">${uniqueMovies.length} películas</span>
                </h3>
                
                <div class="grid grid-cols-1 gap-3">
                    ${uniqueMovies.map(movie => {
            const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
            const posterUrl = movie.poster_path ? `${API_CONFIG.imageBaseUrl}/w92${movie.poster_path}` : null;

            return `
                            <div class="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl active:bg-dark-600 transition-colors cursor-pointer" onclick="showMovieDetail(${movie.id})">
                                ${posterUrl
                    ? `<img src="${posterUrl}" alt="" class="w-12 h-16 rounded-lg object-cover">`
                    : `<div class="w-12 h-16 rounded-lg bg-dark-600 flex items-center justify-center text-xl">🎬</div>`
                }
                                <div class="flex-1 min-w-0">
                                    <h4 class="font-medium truncate text-white">${movie.title}</h4>
                                    <div class="flex items-center gap-2 text-sm text-gray-400">
                                        <span>${year}</span>
                                        ${movie.character ? `<span class="text-gray-600">•</span> <span class="truncate text-gray-500">as ${movie.character}</span>` : ''}
                                    </div>
                                </div>
                                <div class="text-gray-500">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                    </svg>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        </div>
    `;
}

// ===== Search =====

async function searchMovies(query) {
    if (!query.trim()) {
        elements.searchResults.innerHTML = '<p class="text-center text-gray-500 py-8">Escribí el nombre de una película</p>';
        return;
    }

    toggleLoader(true);

    try {
        const data = await fetchFromTMDB('/search/movie', { query });
        renderSearchResults(data.results);
    } catch (error) {
        elements.searchResults.innerHTML = '<p class="text-center text-red-400 py-8">Error al buscar</p>';
    } finally {
        toggleLoader(false);
    }
}

function renderSearchResults(movies) {
    if (!movies || movies.length === 0) {
        elements.searchResults.innerHTML = '<p class="text-center text-gray-500 py-8">No se encontraron películas</p>';
        return;
    }

    elements.searchResults.innerHTML = movies.slice(0, 15).map(movie => {
        const posterUrl = movie.poster_path ? `${API_CONFIG.imageBaseUrl}/w92${movie.poster_path}` : null;
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
        const inRanking = rankingData.some(m => m.id === movie.id);

        moviesCache[movie.id] = movie;

        return `
            <div class="flex items-center gap-3 p-3 bg-dark-700 rounded-xl mb-2">
                ${posterUrl
                ? `<img src="${posterUrl}" alt="" class="w-12 h-16 rounded-lg object-cover">`
                : `<div class="w-12 h-16 rounded-lg bg-dark-600 flex items-center justify-center text-xl">🎬</div>`
            }
                <div class="flex-1 min-w-0" onclick="showMovieDetail(${movie.id})">
                    <p class="font-medium truncate">${movie.title}</p>
                    <p class="text-sm text-gray-400">${year}</p>
                </div>
                <button id="addBtn-${movie.id}" onclick="toggleRankingFromSearch(${movie.id}, this)" 
                    class="w-10 h-10 ${inRanking ? 'bg-gray-600 text-white' : 'bg-accent-yellow text-dark-900'} rounded-full text-lg font-medium flex items-center justify-center"
                >
                    ${inRanking ? '✓' : '+'}
                </button>
            </div>
        `;
    }).join('');
}

// ===== Ranking Actions =====

async function addToRanking(movieId) {
    if (rankingData.some(m => m.id === movieId)) {
        return;
    }

    toggleLoader(true);

    try {
        let movie = moviesCache[movieId];
        if (!movie) {
            movie = await fetchFromTMDB(`/movie/${movieId}`);
            moviesCache[movieId] = movie;
        }

        const movieData = {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path || null,
            backdrop_path: movie.backdrop_path || null,
            release_date: movie.release_date || null,
            vote_average: movie.vote_average || 0,
            votes: 0,
            addedBy: currentUser,
            addedAt: Date.now()
        };

        if (rankingRef) {
            await rankingRef.child(movie.id.toString()).set(movieData);
        }
    } catch (error) {
        console.error('Error adding to ranking:', error);
        alert('Error al agregar al ranking');
    } finally {
        toggleLoader(false);
    }
}

async function toggleRankingFromSearch(movieId, buttonElement) {
    const inRanking = rankingData.some(m => m.id === movieId);

    if (inRanking) {
        // Remove from ranking
        if (rankingRef) {
            await rankingRef.child(movieId.toString()).remove();
        }
        buttonElement.innerHTML = '+';
        buttonElement.classList.remove('bg-gray-600', 'text-white');
        buttonElement.classList.add('bg-accent-yellow', 'text-dark-900');
    } else {
        // Add to ranking
        buttonElement.innerHTML = '✓';
        buttonElement.classList.remove('bg-accent-yellow', 'text-dark-900');
        buttonElement.classList.add('bg-gray-600', 'text-white');
        await addToRanking(movieId);
    }
}

async function removeFromRanking(movieId) {
    if (confirm('¿Eliminar esta película del ranking?')) {
        if (rankingRef) {
            await rankingRef.child(movieId.toString()).remove();
        }
        showHomeView();
    }
}

async function resetRanking() {
    if (confirm('¿Seguro que querés borrar TODO el ranking?')) {
        if (rankingRef) {
            await rankingRef.remove();
        }
        alert('Ranking borrado');
    }
}

// ===== Voting =====

async function voteForMovie(movieId) {
    if (!currentUser || !votesRef || !rankingRef) return;

    const currentWeek = getCurrentWeek();
    const userVotesSnapshot = await votesRef.child(currentUser).once('value');
    let userData = userVotesSnapshot.val() || { week: currentWeek, remaining: 5 };

    if (userData.week !== currentWeek) {
        userData = { week: currentWeek, remaining: 5 };
    }

    if (userData.remaining <= 0) {
        alert('¡Ya usaste todos tus votos de esta semana! 🗳️');
        return;
    }

    // Decrease user votes
    await votesRef.child(currentUser).set({
        week: currentWeek,
        remaining: userData.remaining - 1
    });

    // Increase movie votes
    const movieSnapshot = await rankingRef.child(movieId.toString()).once('value');
    const movie = movieSnapshot.val();

    if (movie) {
        const votedBy = movie.votedBy || {};
        votedBy[currentUser] = (votedBy[currentUser] || 0) + 1;

        await rankingRef.child(movieId.toString()).update({
            votes: (movie.votes || 0) + 1,
            votedBy: votedBy
        });
    }

    // Refresh movie detail if we're viewing it
    loadMovieDetail(movieId);
}

async function removeVoteFromMovie(movieId) {
    if (!currentUser || !votesRef || !rankingRef) return;

    const movieSnapshot = await rankingRef.child(movieId.toString()).once('value');
    const movie = movieSnapshot.val();

    if (!movie || (movie.votes || 0) <= 0) {
        return;
    }

    const currentWeek = getCurrentWeek();

    // Return vote to user
    const userVotesSnapshot = await votesRef.child(currentUser).once('value');
    let userData = userVotesSnapshot.val() || { week: currentWeek, remaining: 5 };

    if (userData.week !== currentWeek) {
        userData = { week: currentWeek, remaining: 5 };
    }

    await votesRef.child(currentUser).set({
        week: currentWeek,
        remaining: userData.remaining + 1
    });

    // Decrease movie votes
    const votedBy = movie.votedBy || {};
    if (votedBy[currentUser] && votedBy[currentUser] > 0) {
        votedBy[currentUser] = votedBy[currentUser] - 1;
    }

    await rankingRef.child(movieId.toString()).update({
        votes: Math.max(0, (movie.votes || 0) - 1),
        votedBy: votedBy
    });

    // Refresh movie detail
    loadMovieDetail(movieId);
}

async function adjustVotes(username, amount) {
    if (!votesRef) return;

    const currentWeek = getCurrentWeek();
    const snapshot = await votesRef.child(username).once('value');
    let data = snapshot.val() || { week: currentWeek, remaining: 5 };

    if (data.week !== currentWeek) {
        data = { week: currentWeek, remaining: 5 };
    }

    data.remaining = Math.max(0, data.remaining + amount);
    await votesRef.child(username).set(data);

    updateProfileView();
}

// ===== Profile =====

async function updateProfileView() {
    document.getElementById('profileAvatar').textContent = currentUser[0];
    document.getElementById('profileName').textContent = currentUser;

    const userVotes = await getRemainingVotes(currentUser);
    document.getElementById('profileVotes').textContent = `${userVotes} votos restantes`;

    const gerVotes = await getRemainingVotes('Ger');
    const maguiVotes = await getRemainingVotes('Magui');

    document.getElementById('gerVotesDisplay').textContent = `${gerVotes} votos`;
    document.getElementById('maguiVotesDisplay').textContent = `${maguiVotes} votos`;
}

async function getRemainingVotes(username) {
    if (!votesRef) return 5;

    const currentWeek = getCurrentWeek();
    const snapshot = await votesRef.child(username).once('value');
    const data = snapshot.val();

    if (!data || data.week !== currentWeek) {
        return 5;
    }

    return data.remaining || 0;
}

// ===== API =====

async function fetchFromTMDB(endpoint, params = {}) {
    const url = new URL(`${API_CONFIG.baseUrl}${endpoint}`);
    url.searchParams.append('api_key', API_CONFIG.apiKey);
    url.searchParams.append('language', API_CONFIG.language);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// ===== Event Listeners =====

document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
        searchMovies(e.target.value);
    }, 500);
});

document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies(e.target.value);
    }
});

// ===== Initialize =====
console.log('🎬 BononaMovie v2.0');
checkAuth();

/**
 * BononaMovie - App de Películas para Ger & Magui
 * Sistema de favoritos y ranking con votos semanales
 * Powered by TMDB API
 * =====================================
 */

// ===== API Configuration =====
const API_CONFIG = {
    baseUrl: 'https://api.themoviedb.org/3',
    apiKey: 'c873a17711bf8960e3754a794af4cf96',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
    language: 'es-ES'
};

// ===== DOM Elements =====
const elements = {
    loginModal: document.getElementById('loginModal'),
    mainContent: document.getElementById('mainContent'),
    sidebar: document.getElementById('sidebar'),
    searchInput: document.getElementById('searchInput'),
    searchInputMobile: document.getElementById('searchInputMobile'),
    searchBtn: document.getElementById('searchBtn'),
    searchBtnMobile: document.getElementById('searchBtnMobile'),
    moviesGrid: document.getElementById('moviesGrid'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    sectionHeader: document.getElementById('sectionHeader'),
    sectionTitle: document.getElementById('sectionTitle'),
    sectionSubtitle: document.getElementById('sectionSubtitle'),
    resultsCount: document.getElementById('resultsCount'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    heroSection: document.getElementById('heroSection'),
    movieModal: document.getElementById('movieModal'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal'),
    // User elements
    headerUsername: document.getElementById('headerUsername'),
    sidebarUsername: document.getElementById('sidebarUsername'),
    sidebarVotes: document.getElementById('sidebarVotes'),
    votesRemaining: document.getElementById('votesRemaining'),
    welcomeUser: document.getElementById('welcomeUser'),
    favoritesCount: document.getElementById('favoritesCount'),
    rankingCount: document.getElementById('rankingCount'),
    // Buttons
    exploreBtn: document.getElementById('exploreBtn'),
    rankingBtn: document.getElementById('rankingBtn'),
    retryBtn: document.getElementById('retryBtn')
};

// ===== Genre Mapping =====
const genreMap = {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia',
    80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
    14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música',
    9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia Ficción',
    10770: 'Película de TV', 53: 'Suspenso', 10752: 'Guerra', 37: 'Western'
};

// ===== State =====
let currentView = 'home';
let currentQuery = '';
let lastAction = null;
let moviesCache = {};

// ===== User Management =====

function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const weekNum = Math.floor(diff / oneWeek);
    return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function login(username) {
    localStorage.setItem('bononaUser', username);
    initializeUserData(username);
    updateUI();
    elements.loginModal.classList.add('hidden');
    elements.mainContent.classList.remove('hidden');
}

function logout() {
    localStorage.removeItem('bononaUser');
    elements.loginModal.classList.remove('hidden');
    elements.mainContent.classList.add('hidden');
    closeSidebar();
}

function getCurrentUser() {
    return localStorage.getItem('bononaUser');
}

function initializeUserData(username) {
    // Initialize favorites if not exists
    const favKey = `bononaFavorites_${username}`;
    if (!localStorage.getItem(favKey)) {
        localStorage.setItem(favKey, JSON.stringify([]));
    }

    // Initialize/reset weekly votes
    const votesKey = `bononaVotes_${username}`;
    const currentWeek = getCurrentWeek();
    const votesData = JSON.parse(localStorage.getItem(votesKey) || '{}');

    if (votesData.week !== currentWeek) {
        localStorage.setItem(votesKey, JSON.stringify({
            week: currentWeek,
            remaining: 5
        }));
    }

    // Initialize ranking if not exists
    if (!localStorage.getItem('bononaRanking')) {
        localStorage.setItem('bononaRanking', JSON.stringify([]));
    }
}

function checkAuth() {
    const user = getCurrentUser();
    if (user) {
        initializeUserData(user);
        elements.loginModal.classList.add('hidden');
        elements.mainContent.classList.remove('hidden');
        updateUI();
    } else {
        elements.loginModal.classList.remove('hidden');
        elements.mainContent.classList.add('hidden');
    }
}

// ===== Favorites Management =====

function getFavorites() {
    const user = getCurrentUser();
    if (!user) return [];
    const favKey = `bononaFavorites_${user}`;
    return JSON.parse(localStorage.getItem(favKey) || '[]');
}

function isFavorite(movieId) {
    return getFavorites().some(m => m.id === movieId);
}

function toggleFavorite(movie, event) {
    if (event) event.stopPropagation();

    const user = getCurrentUser();
    if (!user) return;

    const favKey = `bononaFavorites_${user}`;
    let favorites = getFavorites();

    const index = favorites.findIndex(m => m.id === movie.id);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids || []
        });
    }

    localStorage.setItem(favKey, JSON.stringify(favorites));
    moviesCache[movie.id] = movie;
    updateUI();

    // Re-render if in favorites view
    if (currentView === 'favorites') {
        showFavorites();
    }
}

// ===== Ranking & Votes Management =====

function getRanking() {
    return JSON.parse(localStorage.getItem('bononaRanking') || '[]');
}

function getRemainingVotes() {
    const user = getCurrentUser();
    if (!user) return 0;

    const votesKey = `bononaVotes_${user}`;
    const currentWeek = getCurrentWeek();
    const votesData = JSON.parse(localStorage.getItem(votesKey) || '{}');

    // Reset if new week
    if (votesData.week !== currentWeek) {
        const newData = { week: currentWeek, remaining: 5 };
        localStorage.setItem(votesKey, JSON.stringify(newData));
        return 5;
    }

    return votesData.remaining || 0;
}

function getMovieVotes(movieId) {
    const ranking = getRanking();
    const movie = ranking.find(m => m.id === movieId);
    return movie ? movie.votes : 0;
}

function getUserVotesForMovie(movieId) {
    const user = getCurrentUser();
    if (!user) return 0;

    const ranking = getRanking();
    const movie = ranking.find(m => m.id === movieId);
    return movie?.votedBy?.[user] || 0;
}

function voteForMovie(movie, event) {
    if (event) event.stopPropagation();

    const user = getCurrentUser();
    if (!user) return;

    const remaining = getRemainingVotes();
    if (remaining <= 0) {
        alert('¡Ya usaste todos tus votos de esta semana! 🗳️');
        return;
    }

    // Update votes count
    const votesKey = `bononaVotes_${user}`;
    const votesData = JSON.parse(localStorage.getItem(votesKey));
    votesData.remaining = remaining - 1;
    localStorage.setItem(votesKey, JSON.stringify(votesData));

    // Update ranking
    let ranking = getRanking();
    let movieInRanking = ranking.find(m => m.id === movie.id);

    if (movieInRanking) {
        movieInRanking.votes = (movieInRanking.votes || 0) + 1;
        movieInRanking.votedBy = movieInRanking.votedBy || {};
        movieInRanking.votedBy[user] = (movieInRanking.votedBy[user] || 0) + 1;
    } else {
        ranking.push({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids || [],
            votes: 1,
            votedBy: { [user]: 1 }
        });
    }

    // Sort by votes
    ranking.sort((a, b) => b.votes - a.votes);
    localStorage.setItem('bononaRanking', JSON.stringify(ranking));

    moviesCache[movie.id] = movie;
    updateUI();

    // Re-render if in ranking view
    if (currentView === 'ranking') {
        showRanking();
    }
}

function removeVoteFromMovie(movieId, event) {
    if (event) event.stopPropagation();

    const user = getCurrentUser();
    if (!user) return;

    const userVotes = getUserVotesForMovie(movieId);
    if (userVotes <= 0) return;

    // Refund vote
    const votesKey = `bononaVotes_${user}`;
    const votesData = JSON.parse(localStorage.getItem(votesKey));
    votesData.remaining = (votesData.remaining || 0) + 1;
    localStorage.setItem(votesKey, JSON.stringify(votesData));

    // Update ranking
    let ranking = getRanking();
    let movieInRanking = ranking.find(m => m.id === movieId);

    if (movieInRanking) {
        movieInRanking.votes = Math.max(0, (movieInRanking.votes || 1) - 1);
        movieInRanking.votedBy[user] = Math.max(0, (movieInRanking.votedBy[user] || 1) - 1);

        // Remove if no votes left
        if (movieInRanking.votes <= 0) {
            ranking = ranking.filter(m => m.id !== movieId);
        }
    }

    ranking.sort((a, b) => b.votes - a.votes);
    localStorage.setItem('bononaRanking', JSON.stringify(ranking));

    updateUI();

    if (currentView === 'ranking') {
        showRanking();
    }
}

// ===== UI Updates =====

function updateUI() {
    const user = getCurrentUser();
    if (!user) return;

    const remaining = getRemainingVotes();
    const favorites = getFavorites();
    const ranking = getRanking();

    // Update header
    if (elements.headerUsername) elements.headerUsername.textContent = user;
    if (elements.sidebarUsername) elements.sidebarUsername.textContent = user;
    if (elements.welcomeUser) elements.welcomeUser.textContent = `¡Hola, ${user}! 👋`;

    // Update votes
    const votesText = `${remaining} voto${remaining !== 1 ? 's' : ''}`;
    if (elements.votesRemaining) elements.votesRemaining.textContent = votesText;
    if (elements.sidebarVotes) elements.sidebarVotes.textContent = `${votesText} restantes`;

    // Update counts
    if (elements.favoritesCount) elements.favoritesCount.textContent = favorites.length;
    if (elements.rankingCount) elements.rankingCount.textContent = ranking.length;
}

// ===== Sidebar =====

function openSidebar() {
    elements.sidebar.classList.remove('hidden');
    setTimeout(() => {
        const content = elements.sidebar.querySelector('.sidebar-content');
        content.classList.remove('-translate-x-full');
    }, 10);
}

function closeSidebar() {
    const content = elements.sidebar.querySelector('.sidebar-content');
    content.classList.add('-translate-x-full');
    setTimeout(() => {
        elements.sidebar.classList.add('hidden');
    }, 300);
}

// ===== Navigation =====

function goHome() {
    currentView = 'home';
    elements.heroSection.classList.remove('hidden');
    hideSectionHeader();
    elements.moviesGrid.innerHTML = '';
    hideEmptyState();
    hideError();
}

function showFavorites() {
    currentView = 'favorites';
    hideHero();
    hideError();

    const favorites = getFavorites();

    if (favorites.length === 0) {
        showSectionHeader('💜 Tus Favoritas', 'Agregá películas a favoritos para verlas acá', 0);
        showEmptyState();
        elements.moviesGrid.innerHTML = '';
    } else {
        displayMovies(favorites, '💜 Tus Favoritas', 'Las películas que guardaste para ver');
    }
}

function showRanking() {
    currentView = 'ranking';
    hideHero();
    hideError();

    const ranking = getRanking();

    if (ranking.length === 0) {
        showSectionHeader('🏆 Ranking', 'Votá películas para armar el ranking', 0);
        showEmptyState();
        elements.moviesGrid.innerHTML = '';
    } else {
        displayMovies(ranking, '🏆 Ranking', 'Las películas más votadas para ver juntos', true);
    }
}

// ===== API Functions =====

async function fetchFromTMDB(endpoint, params = {}) {
    const url = new URL(`${API_CONFIG.baseUrl}${endpoint}`);
    url.searchParams.append('api_key', API_CONFIG.apiKey);
    url.searchParams.append('language', API_CONFIG.language);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('API Key inválida.');
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Cache movies
        if (data.results) {
            data.results.forEach(m => moviesCache[m.id] = m);
        }

        return data;
    } catch (error) {
        console.error('Error fetching from TMDB:', error);
        throw error;
    }
}

async function searchMovies(query) {
    if (!query.trim()) return;

    currentView = 'search';
    currentQuery = query;
    lastAction = { type: 'search', query };
    showLoading();
    hideHero();

    try {
        const data = await fetchFromTMDB('/search/movie', { query });
        displayMovies(data.results, `Resultados para "${query}"`, `Encontramos estas películas`);
    } catch (error) {
        showError(error.message);
    }
}

async function getPopularMovies() {
    currentView = 'popular';
    lastAction = { type: 'popular' };
    showLoading();
    hideHero();

    try {
        const data = await fetchFromTMDB('/movie/popular');
        displayMovies(data.results, '🔥 Películas Populares', 'Las más vistas del momento');
    } catch (error) {
        showError(error.message);
    }
}

async function getMovieDetails(movieId) {
    try {
        const data = await fetchFromTMDB(`/movie/${movieId}`);
        moviesCache[movieId] = data;
        showMovieModal(data);
    } catch (error) {
        console.error('Error getting movie details:', error);
    }
}

// ===== UI Functions =====

function displayMovies(movies, title, subtitle, isRanking = false) {
    hideLoading();
    hideError();

    if (!movies || movies.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();
    showSectionHeader(title, subtitle, movies.length);

    elements.moviesGrid.innerHTML = movies.map((movie, index) =>
        createMovieCard(movie, isRanking ? index + 1 : null)
    ).join('');

    // Add click events
    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const movieId = parseInt(card.dataset.movieId);
            getMovieDetails(movieId);
        });
    });
}

function createMovieCard(movie, rankPosition = null) {
    const posterUrl = movie.poster_path
        ? `${API_CONFIG.imageBaseUrl}/w500${movie.poster_path}`
        : null;

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : 'N/A';

    const rating = movie.vote_average
        ? movie.vote_average.toFixed(1)
        : 'N/A';

    const genres = movie.genre_ids
        ? movie.genre_ids.slice(0, 2).map(id => genreMap[id] || 'Otro')
        : [];

    const isFav = isFavorite(movie.id);
    const votes = movie.votes || getMovieVotes(movie.id);
    const userVotes = getUserVotesForMovie(movie.id);
    const remaining = getRemainingVotes();

    const posterHTML = posterUrl
        ? `<img src="${posterUrl}" alt="${movie.title}" loading="lazy">`
        : `<div class="no-poster">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span>Sin imagen</span>
           </div>`;

    return `
        <article class="movie-card glass-card" data-movie-id="${movie.id}">
            <div class="movie-poster">
                ${posterHTML}
                ${rankPosition ? `<div class="rank-badge">#${rankPosition}</div>` : ''}
                <div class="rating-badge">
                    <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    ${rating}
                </div>
                <!-- Action Buttons -->
                <div class="card-actions">
                    <button 
                        class="action-btn favorite-btn ${isFav ? 'active' : ''}" 
                        onclick="toggleFavorite(moviesCache[${movie.id}], event)"
                        title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
                    >
                        <svg fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                    </button>
                    <button 
                        class="action-btn vote-btn ${userVotes > 0 ? 'active' : ''}" 
                        onclick="voteForMovie(moviesCache[${movie.id}], event)"
                        title="${remaining > 0 ? 'Votar para ver' : 'Sin votos'}"
                        ${remaining <= 0 && userVotes <= 0 ? 'disabled' : ''}
                    >
                        <svg fill="${userVotes > 0 ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                        </svg>
                        ${votes > 0 ? `<span class="vote-count">${votes}</span>` : ''}
                    </button>
                </div>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <p class="movie-year">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    ${year}
                </p>
                ${genres.length > 0 ? `
                    <div class="genre-tags">
                        ${genres.map(genre => `<span class="genre-tag">${genre}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        </article>
    `;
}

function showMovieModal(movie) {
    const backdropUrl = movie.backdrop_path
        ? `${API_CONFIG.imageBaseUrl}/original${movie.backdrop_path}`
        : movie.poster_path
            ? `${API_CONFIG.imageBaseUrl}/original${movie.poster_path}`
            : null;

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : 'N/A';

    const runtime = movie.runtime
        ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
        : 'N/A';

    const rating = movie.vote_average || 0;
    const fullStars = Math.floor(rating / 2);
    const emptyStars = 5 - fullStars;

    const genres = movie.genres
        ? movie.genres.map(g => g.name).join(', ')
        : 'N/A';

    const isFav = isFavorite(movie.id);
    const userVotes = getUserVotesForMovie(movie.id);
    const remaining = getRemainingVotes();

    elements.modalContent.innerHTML = `
        ${backdropUrl ? `
            <div class="modal-backdrop">
                <img src="${backdropUrl}" alt="${movie.title}">
            </div>
        ` : ''}
        <div class="modal-content">
            <h2 class="modal-title">${movie.title}</h2>
            
            <div class="modal-meta">
                <div class="modal-meta-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    ${year}
                </div>
                <div class="modal-meta-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ${runtime}
                </div>
                <div class="modal-meta-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"></path>
                    </svg>
                    ${genres}
                </div>
            </div>

            <p class="modal-overview">${movie.overview || 'Sin descripción disponible.'}</p>

            <!-- Action Buttons -->
            <div class="modal-actions">
                <button 
                    class="modal-action-btn ${isFav ? 'active' : ''}"
                    onclick="toggleFavorite(moviesCache[${movie.id}], event); document.getElementById('movieModal').classList.add('hidden'); document.body.style.overflow = '';"
                >
                    <svg fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    ${isFav ? 'En Favoritas' : 'Agregar a Favoritas'}
                </button>
                <button 
                    class="modal-action-btn vote ${userVotes > 0 ? 'active' : ''}"
                    onclick="voteForMovie(moviesCache[${movie.id}], event); document.getElementById('movieModal').classList.add('hidden'); document.body.style.overflow = '';"
                    ${remaining <= 0 && userVotes <= 0 ? 'disabled' : ''}
                >
                    <svg fill="${userVotes > 0 ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                    </svg>
                    ${userVotes > 0 ? `Votada (${userVotes})` : 'Votar para Ver'}
                </button>
            </div>

            <div class="modal-rating">
                <span class="modal-rating-score">${rating.toFixed(1)}</span>
                <div>
                    <div class="modal-rating-stars">
                        ${'<svg class="star-filled" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>'.repeat(fullStars)}
                        ${'<svg class="star-empty" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>'.repeat(emptyStars)}
                    </div>
                    <p style="font-size: 0.875rem; color: rgba(255,255,255,0.5); margin-top: 4px;">
                        ${movie.vote_count?.toLocaleString() || 0} votos en TMDB
                    </p>
                </div>
            </div>
        </div>
    `;

    elements.movieModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeMovieModal() {
    elements.movieModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// ===== Helper Functions =====

function showLoading() {
    elements.loadingIndicator.classList.remove('hidden');
    elements.moviesGrid.innerHTML = '';
}

function hideLoading() {
    elements.loadingIndicator.classList.add('hidden');
}

function showSectionHeader(title, subtitle, count) {
    elements.sectionHeader.classList.remove('hidden');
    elements.sectionTitle.textContent = title;
    elements.sectionSubtitle.textContent = subtitle;
    elements.resultsCount.textContent = `${count} película${count !== 1 ? 's' : ''}`;
}

function hideSectionHeader() {
    elements.sectionHeader.classList.add('hidden');
}

function showEmptyState() {
    elements.emptyState.classList.remove('hidden');
}

function hideEmptyState() {
    elements.emptyState.classList.add('hidden');
}

function showError(message) {
    hideLoading();
    hideEmptyState();
    hideSectionHeader();
    elements.errorState.classList.remove('hidden');
    elements.errorMessage.textContent = message;
}

function hideError() {
    elements.errorState.classList.add('hidden');
}

function hideHero() {
    elements.heroSection.classList.add('hidden');
}

function showHero() {
    elements.heroSection.classList.remove('hidden');
}

function retryLastAction() {
    if (!lastAction) return;

    switch (lastAction.type) {
        case 'search':
            searchMovies(lastAction.query);
            break;
        case 'popular':
            getPopularMovies();
            break;
    }
}

// ===== Event Listeners =====

// Search functionality
elements.searchBtn?.addEventListener('click', () => {
    searchMovies(elements.searchInput.value);
});

elements.searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies(elements.searchInput.value);
    }
});

elements.searchBtnMobile?.addEventListener('click', () => {
    searchMovies(elements.searchInputMobile.value);
});

elements.searchInputMobile?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies(elements.searchInputMobile.value);
    }
});

// Navigation buttons
elements.exploreBtn?.addEventListener('click', getPopularMovies);
elements.rankingBtn?.addEventListener('click', showRanking);
elements.retryBtn?.addEventListener('click', retryLastAction);

// Modal events
elements.closeModal?.addEventListener('click', closeMovieModal);
elements.movieModal?.addEventListener('click', (e) => {
    if (e.target === elements.movieModal) {
        closeMovieModal();
    }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!elements.movieModal.classList.contains('hidden')) {
            closeMovieModal();
        }
        if (!elements.sidebar.classList.contains('hidden')) {
            closeSidebar();
        }
    }
});

// ===== Initialization =====
console.log('🎬 BononaMovie initialized');
checkAuth();

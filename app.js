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

// ===== DOM Elements =====
const elements = {
    loginModal: document.getElementById('loginModal'),
    mainContent: document.getElementById('mainContent'),
    sidebar: document.getElementById('sidebar'),
    heroSection: document.getElementById('heroSection'),
    moviesSection: document.getElementById('moviesSection'),
    settingsSection: document.getElementById('settingsSection'),
    searchModal: document.getElementById('searchModal'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    moviesGrid: document.getElementById('moviesGrid'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    sectionHeader: document.getElementById('sectionHeader'),
    sectionTitle: document.getElementById('sectionTitle'),
    sectionSubtitle: document.getElementById('sectionSubtitle'),
    resultsCount: document.getElementById('resultsCount'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    movieModal: document.getElementById('movieModal'),
    modalContent: document.getElementById('modalContent'),
    closeModal: document.getElementById('closeModal'),
    // User elements
    sidebarUsername: document.getElementById('sidebarUsername'),
    sidebarVotes: document.getElementById('sidebarVotes'),
    votesRemaining: document.getElementById('votesRemaining'),
    welcomeUser: document.getElementById('welcomeUser'),
    favoritesCount: document.getElementById('favoritesCount'),
    rankingCount: document.getElementById('rankingCount'),
    gerVotesDisplay: document.getElementById('gerVotesDisplay'),
    maguiVotesDisplay: document.getElementById('maguiVotesDisplay'),
    // Buttons
    addToRankingBtn: document.getElementById('addToRankingBtn'),
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
let moviesCache = {};
let rankingData = [];

// ===== Firebase References =====
const rankingRef = window.db ? window.db.ref('ranking') : null;
const votesRef = window.db ? window.db.ref('votes') : null;

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
    const favKey = `bononaFavorites_${username}`;
    if (!localStorage.getItem(favKey)) {
        localStorage.setItem(favKey, JSON.stringify([]));
    }

    // Initialize votes in Firebase
    initializeVotesInFirebase(username);
}

async function initializeVotesInFirebase(username) {
    if (!votesRef) return;

    const currentWeek = getCurrentWeek();
    const userVotesRef = votesRef.child(username);

    const snapshot = await userVotesRef.once('value');
    const data = snapshot.val();

    if (!data || data.week !== currentWeek) {
        await userVotesRef.set({
            week: currentWeek,
            remaining: 5
        });
    }
}

function checkAuth() {
    const user = getCurrentUser();
    if (user) {
        initializeUserData(user);
        elements.loginModal.classList.add('hidden');
        elements.mainContent.classList.remove('hidden');
        updateUI();
        setupFirebaseListeners();
    } else {
        elements.loginModal.classList.remove('hidden');
        elements.mainContent.classList.add('hidden');
    }
}

// ===== Firebase Listeners =====

function setupFirebaseListeners() {
    if (!rankingRef) {
        console.warn('Firebase not available, using localStorage');
        return;
    }

    // Listen for ranking changes
    rankingRef.on('value', (snapshot) => {
        const data = snapshot.val();
        rankingData = data ? Object.values(data) : [];
        rankingData.sort((a, b) => (b.votes || 0) - (a.votes || 0));

        if (elements.rankingCount) {
            elements.rankingCount.textContent = rankingData.length;
        }

        // If we're viewing ranking, refresh it
        if (currentView === 'ranking') {
            showRanking();
        }
    });

    // Listen for votes changes
    const user = getCurrentUser();
    if (user && votesRef) {
        votesRef.child(user).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateVotesDisplay(data.remaining || 0);
            }
        });
    }
}

function updateVotesDisplay(remaining) {
    if (elements.votesRemaining) elements.votesRemaining.textContent = remaining;
    if (elements.sidebarVotes) elements.sidebarVotes.textContent = `${remaining} votos restantes`;
}

// ===== Favorites Management (Local) =====

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
            genre_ids: movie.genre_ids || movie.genres?.map(g => g.id) || []
        });
    }

    localStorage.setItem(favKey, JSON.stringify(favorites));
    moviesCache[movie.id] = movie;
    updateUI();

    if (currentView === 'favorites') {
        showFavorites();
    }
}

// ===== Ranking Management (Firebase) =====

function getRanking() {
    return rankingData;
}

function isInRanking(movieId) {
    return rankingData.some(m => m.id === movieId);
}

async function addToRanking(movie, event) {
    if (event) event.stopPropagation();

    if (isInRanking(movie.id)) {
        alert('Esta película ya está en el ranking');
        return;
    }

    const movieData = {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path || null,
        release_date: movie.release_date || null,
        vote_average: movie.vote_average || 0,
        genre_ids: movie.genre_ids || movie.genres?.map(g => g.id) || [],
        votes: 0,
        addedBy: getCurrentUser(),
        addedAt: Date.now()
    };

    if (rankingRef) {
        await rankingRef.child(movie.id.toString()).set(movieData);
    }

    moviesCache[movie.id] = movie;
    closeSearchModal();
    alert(`"${movie.title}" agregada al ranking 🎬`);
}

async function removeFromRanking(movieId, event) {
    if (event) event.stopPropagation();

    if (rankingRef) {
        await rankingRef.child(movieId.toString()).remove();
    }

    if (currentView === 'ranking') {
        showRanking();
    }
}

async function resetRanking() {
    if (confirm('¿Seguro que querés borrar todo el ranking?')) {
        if (rankingRef) {
            await rankingRef.remove();
        }
        alert('Ranking borrado');
    }
}

// ===== Votes Management (Firebase) =====

async function getRemainingVotes(username = null) {
    const user = username || getCurrentUser();
    if (!user || !votesRef) return 0;

    const currentWeek = getCurrentWeek();
    const snapshot = await votesRef.child(user).once('value');
    const data = snapshot.val();

    if (!data || data.week !== currentWeek) {
        await votesRef.child(user).set({ week: currentWeek, remaining: 5 });
        return 5;
    }

    return data.remaining || 0;
}

function getUserVotesForMovie(movieId) {
    const user = getCurrentUser();
    if (!user) return 0;

    const movie = rankingData.find(m => m.id === movieId);
    return movie?.votedBy?.[user] || 0;
}

async function voteForMovie(movieId, event) {
    if (event) event.stopPropagation();

    const user = getCurrentUser();
    if (!user) return;

    const remaining = await getRemainingVotes();
    if (remaining <= 0) {
        alert('¡Ya usaste todos tus votos de esta semana! 🗳️');
        return;
    }

    // Update user votes
    const currentWeek = getCurrentWeek();
    await votesRef.child(user).set({
        week: currentWeek,
        remaining: remaining - 1
    });

    // Update movie votes
    const movieRef = rankingRef.child(movieId.toString());
    const snapshot = await movieRef.once('value');
    const movie = snapshot.val();

    if (movie) {
        const newVotes = (movie.votes || 0) + 1;
        const votedBy = movie.votedBy || {};
        votedBy[user] = (votedBy[user] || 0) + 1;

        await movieRef.update({
            votes: newVotes,
            votedBy: votedBy
        });
    }

    updateUI();
}

async function adjustVotes(username, amount) {
    if (!votesRef) return;

    const currentWeek = getCurrentWeek();
    const snapshot = await votesRef.child(username).once('value');
    let data = snapshot.val();

    if (!data || data.week !== currentWeek) {
        data = { week: currentWeek, remaining: 5 };
    }

    data.remaining = Math.max(0, (data.remaining || 0) + amount);
    await votesRef.child(username).set(data);

    updateSettingsDisplay();
}

async function updateSettingsDisplay() {
    const gerVotes = await getRemainingVotes('Ger');
    const maguiVotes = await getRemainingVotes('Magui');

    if (elements.gerVotesDisplay) {
        elements.gerVotesDisplay.textContent = `${gerVotes} votos restantes`;
    }
    if (elements.maguiVotesDisplay) {
        elements.maguiVotesDisplay.textContent = `${maguiVotes} votos restantes`;
    }
}

// ===== UI Updates =====

async function updateUI() {
    const user = getCurrentUser();
    if (!user) return;

    const remaining = await getRemainingVotes();
    const favorites = getFavorites();

    if (elements.sidebarUsername) elements.sidebarUsername.textContent = user;
    if (elements.welcomeUser) elements.welcomeUser.textContent = `¡Hola, ${user}! 👋`;

    updateVotesDisplay(remaining);

    if (elements.favoritesCount) elements.favoritesCount.textContent = favorites.length;
    if (elements.rankingCount) elements.rankingCount.textContent = rankingData.length;
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

function hideAllSections() {
    elements.heroSection.classList.add('hidden');
    elements.moviesSection.classList.add('hidden');
    elements.settingsSection.classList.add('hidden');
    hideEmptyState();
    hideError();
}

function goHome() {
    currentView = 'home';
    hideAllSections();
    elements.heroSection.classList.remove('hidden');
    hideSectionHeader();
    elements.moviesGrid.innerHTML = '';
}

function showFavorites() {
    currentView = 'favorites';
    hideAllSections();
    elements.moviesSection.classList.remove('hidden');

    const favorites = getFavorites();

    if (favorites.length === 0) {
        showSectionHeader('💜 Tus Favoritas', 'Agregá películas a favoritos', 0);
        showEmptyState();
        elements.moviesGrid.innerHTML = '';
    } else {
        displayMovies(favorites, '💜 Tus Favoritas', 'Las películas que guardaste');
    }
}

function showRanking() {
    currentView = 'ranking';
    hideAllSections();
    elements.moviesSection.classList.remove('hidden');

    const ranking = getRanking();

    if (ranking.length === 0) {
        showSectionHeader('🏆 Ranking', 'Agregá películas para votar', 0);
        showEmptyState();
        elements.moviesGrid.innerHTML = '';
    } else {
        displayMovies(ranking, '🏆 Ranking', 'Votá las que quieras ver primero', true);
    }
}

function showSettings() {
    currentView = 'settings';
    hideAllSections();
    elements.settingsSection.classList.remove('hidden');
    updateSettingsDisplay();
}

// ===== Search Modal =====

function openSearchModal() {
    elements.searchModal.classList.remove('hidden');
    elements.searchInput.value = '';
    elements.searchInput.focus();
    elements.searchResults.innerHTML = '<p class="text-center text-gray-500 py-8">Escribí el nombre de una película</p>';
}

function closeSearchModal() {
    elements.searchModal.classList.add('hidden');
}

async function searchMovies(query) {
    if (!query.trim()) return;

    elements.searchResults.innerHTML = '<div class="flex justify-center py-8"><div class="w-8 h-8 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"></div></div>';

    try {
        const data = await fetchFromTMDB('/search/movie', { query });
        displaySearchResults(data.results);
    } catch (error) {
        elements.searchResults.innerHTML = '<p class="text-center text-red-400 py-8">Error al buscar</p>';
    }
}

function displaySearchResults(movies) {
    if (!movies || movies.length === 0) {
        elements.searchResults.innerHTML = '<p class="text-center text-gray-500 py-8">No se encontraron películas</p>';
        return;
    }

    elements.searchResults.innerHTML = movies.slice(0, 10).map(movie => {
        const posterUrl = movie.poster_path
            ? `${API_CONFIG.imageBaseUrl}/w92${movie.poster_path}`
            : null;
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
        const inRanking = isInRanking(movie.id);

        moviesCache[movie.id] = movie;

        return `
            <div class="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl mb-2 ${inRanking ? 'opacity-50' : ''}">
                ${posterUrl
                ? `<img src="${posterUrl}" class="w-12 h-16 rounded-lg object-cover" alt="">`
                : `<div class="w-12 h-16 rounded-lg bg-dark-600 flex items-center justify-center text-gray-500 text-xs">?</div>`
            }
                <div class="flex-1 min-w-0">
                    <p class="font-medium truncate">${movie.title}</p>
                    <p class="text-sm text-gray-400">${year}</p>
                </div>
                <button 
                    onclick="addToRanking(moviesCache[${movie.id}], event)"
                    class="px-4 py-2 ${inRanking ? 'bg-gray-600 text-gray-400' : 'bg-gradient-to-r from-accent-purple to-accent-pink'} rounded-xl text-sm font-medium"
                    ${inRanking ? 'disabled' : ''}
                >
                    ${inRanking ? 'Ya está' : '+ Agregar'}
                </button>
            </div>
        `;
    }).join('');
}

// ===== API Functions =====

async function fetchFromTMDB(endpoint, params = {}) {
    const url = new URL(`${API_CONFIG.baseUrl}${endpoint}`);
    url.searchParams.append('api_key', API_CONFIG.apiKey);
    url.searchParams.append('language', API_CONFIG.language);

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.results) {
        data.results.forEach(m => moviesCache[m.id] = m);
    }
    return data;
}

async function getMovieDetails(movieId) {
    try {
        const data = await fetchFromTMDB(`/movie/${movieId}`);
        moviesCache[movieId] = data;
        showMovieModal(data);
    } catch (error) {
        console.error('Error:', error);
    }
}

// ===== Display Functions =====

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
        createMovieCard(movie, isRanking ? index + 1 : null, isRanking)
    ).join('');

    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const movieId = parseInt(card.dataset.movieId);
            getMovieDetails(movieId);
        });
    });
}

function createMovieCard(movie, rankPosition = null, isRanking = false) {
    const posterUrl = movie.poster_path
        ? `${API_CONFIG.imageBaseUrl}/w500${movie.poster_path}`
        : null;

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : '';

    const votes = movie.votes || 0;
    const userVotes = getUserVotesForMovie(movie.id);

    const posterHTML = posterUrl
        ? `<img src="${posterUrl}" alt="${movie.title}" loading="lazy">`
        : `<div class="no-poster"><span>?</span></div>`;

    return `
        <article class="movie-card glass-card" data-movie-id="${movie.id}">
            <div class="movie-poster">
                ${posterHTML}
                ${rankPosition ? `<div class="rank-badge">#${rankPosition}</div>` : ''}
                ${isRanking ? `
                    <div class="votes-badge">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        ${votes}
                    </div>
                ` : ''}
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${movie.title}</h3>
                <p class="movie-year">${year}</p>
                ${isRanking ? `
                    <button 
                        onclick="voteForMovie(${movie.id}, event)"
                        class="vote-btn mt-2 w-full py-2 ${userVotes > 0 ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' : 'bg-accent-purple/20 text-accent-purple border-accent-purple/30'} border rounded-lg text-sm font-medium"
                    >
                        ${userVotes > 0 ? `⭐ Votada (${userVotes})` : '🗳️ Votar'}
                    </button>
                ` : ''}
            </div>
        </article>
    `;
}

function showMovieModal(movie) {
    const backdropUrl = movie.backdrop_path
        ? `${API_CONFIG.imageBaseUrl}/w780${movie.backdrop_path}`
        : movie.poster_path
            ? `${API_CONFIG.imageBaseUrl}/w500${movie.poster_path}`
            : null;

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : '';

    const rating = movie.vote_average || 0;
    const inRanking = isInRanking(movie.id);
    const isFav = isFavorite(movie.id);

    elements.modalContent.innerHTML = `
        ${backdropUrl ? `
            <div class="modal-backdrop">
                <img src="${backdropUrl}" alt="${movie.title}">
            </div>
        ` : ''}
        <div class="modal-content">
            <h2 class="modal-title">${movie.title}</h2>
            
            <div class="flex flex-wrap gap-2 mb-4">
                <span class="px-3 py-1 bg-dark-700 rounded-lg text-sm">${year}</span>
                <span class="px-3 py-1 bg-yellow-400/20 text-yellow-400 rounded-lg text-sm">⭐ ${rating.toFixed(1)}</span>
            </div>

            <p class="text-gray-400 text-sm mb-6 leading-relaxed">${movie.overview || 'Sin descripción.'}</p>

            <div class="flex flex-col gap-2">
                <button 
                    onclick="addToRanking(moviesCache[${movie.id}], event); closeMovieModal();"
                    class="w-full py-3 ${inRanking ? 'bg-gray-600 text-gray-400' : 'bg-gradient-to-r from-accent-purple to-accent-pink'} rounded-xl font-medium"
                    ${inRanking ? 'disabled' : ''}
                >
                    ${inRanking ? '✓ Ya está en el ranking' : '➕ Agregar al Ranking'}
                </button>
                <button 
                    onclick="toggleFavorite(moviesCache[${movie.id}], event); closeMovieModal();"
                    class="w-full py-3 ${isFav ? 'bg-accent-pink/20 text-accent-pink border-accent-pink/30' : 'bg-dark-700 border-white/10'} border rounded-xl font-medium"
                >
                    ${isFav ? '💜 En Favoritas' : '🤍 Agregar a Favoritas'}
                </button>
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
    elements.errorState.classList.remove('hidden');
    elements.errorMessage.textContent = message;
}

function hideError() {
    elements.errorState.classList.add('hidden');
}

// ===== Event Listeners =====

elements.addToRankingBtn?.addEventListener('click', openSearchModal);
elements.rankingBtn?.addEventListener('click', showRanking);

elements.searchBtn?.addEventListener('click', () => {
    searchMovies(elements.searchInput.value);
});

elements.searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies(elements.searchInput.value);
    }
});

elements.closeModal?.addEventListener('click', closeMovieModal);
elements.movieModal?.addEventListener('click', (e) => {
    if (e.target === elements.movieModal) {
        closeMovieModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!elements.movieModal.classList.contains('hidden')) closeMovieModal();
        if (!elements.sidebar.classList.contains('hidden')) closeSidebar();
        if (!elements.searchModal.classList.contains('hidden')) closeSearchModal();
    }
});

// ===== Initialization =====
console.log('🎬 BononaMovie initialized with Firebase');
checkAuth();

document.addEventListener("DOMContentLoaded", () => {
    // --- Element Selections ---
    const feedContainer = document.getElementById("news-feed-container");
    const loadingContainer = document.getElementById("loading");
    const filterContainer = document.getElementById("filter-container");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const themeToggle = document.getElementById("checkbox");

    // --- State Management ---
    const NEWS_ENDPOINT = "/.netlify/functions/getNews";
    let masterArticleList = [];
    let currentlyDisplayedArticles = [];
    let currentPage = 1;
    const ARTICLES_PER_PAGE = 10;
    
    // --- Bookmark State ---
    let bookmarkedArticles = [];

    // --- Bookmark Functions ---
    function loadBookmarks() {
        const savedBookmarks = localStorage.getItem('cyberNewsBookmarks');
        if (savedBookmarks) {
            bookmarkedArticles = JSON.parse(savedBookmarks);
        }
    }

    function saveBookmarks() {
        localStorage.setItem('cyberNewsBookmarks', JSON.stringify(bookmarkedArticles));
    }

    function toggleBookmark(articleLink) {
        const bookmarkIndex = bookmarkedArticles.indexOf(articleLink);
        if (bookmarkIndex > -1) {
            bookmarkedArticles.splice(bookmarkIndex, 1);
        } else {
            bookmarkedArticles.push(articleLink);
        }
        saveBookmarks();
    }

    // --- Dark Mode ---
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    }

    // --- Rendering Functions ---
    function renderArticles(articles) {
        const fragment = document.createDocumentFragment();
        for (const item of articles) {
            const articleElement = document.createElement("div");
            articleElement.className = "article-card";
            const publicationDate = new Date(item.pubDate).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
            const imageUrl = (item.imageUrl && item.imageUrl.startsWith('http')) ? item.imageUrl : 'https://i.imgur.com/gY9V3sD.jpeg';
            
            const isBookmarked = bookmarkedArticles.includes(item.link);
            const bookmarkedClass = isBookmarked ? 'bookmarked' : '';

            articleElement.innerHTML = `
                <div class="card-image-container">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                        <img src="${imageUrl}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://i.imgur.com/gY9V3sD.jpeg';">
                    </a>
                </div>
                <div class="card-content">
                    <svg class="bookmark-icon ${bookmarkedClass}" data-link="${item.link}">
                        <use xlink:href="#icon-bookmark"></use>
                    </svg>
                    <div class="article-meta">
                        <span class="article-source">${item.source}</span>
                        <span class="article-date">${publicationDate}</span>
                    </div>
                    <h2 class="article-title"><a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a></h2>
                    <p class="article-description">${item.description}</p>
                </div>`;
            fragment.appendChild(articleElement);
        }
        feedContainer.appendChild(fragment);
    }

    // --- "Load More" Logic ---
    function loadMoreArticles() {
        currentPage++;
        const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
        const endIndex = currentPage * ARTICLES_PER_PAGE;
        const newArticles = currentlyDisplayedArticles.slice(startIndex, endIndex);
        renderArticles(newArticles);

        if (endIndex >= currentlyDisplayedArticles.length) {
            loadMoreBtn.style.display = 'none';
        }
    }
    loadMoreBtn.addEventListener('click', loadMoreArticles);
    
    // --- Event listener for bookmark clicks ---
    feedContainer.addEventListener('click', (e) => {
        const bookmarkIcon = e.target.closest('.bookmark-icon');
        if (bookmarkIcon) {
            const articleLink = bookmarkIcon.dataset.link;
            toggleBookmark(articleLink);
            bookmarkIcon.classList.toggle('bookmarked');
            if (filterContainer.querySelector('.filter-btn.active')?.dataset.source === 'Bookmarked') {
                applyFilters();
            }
        }
    });

    // --- Filtering Logic ---
    function applyFilters() {
        const activeFilterButton = filterContainer.querySelector('.filter-btn.active');
        const selectedSource = activeFilterButton ? activeFilterButton.dataset.source : 'All';

        if (selectedSource === 'All') {
            currentlyDisplayedArticles = [...masterArticleList];
        } else if (selectedSource === 'Bookmarked') {
            currentlyDisplayedArticles = masterArticleList.filter(article => bookmarkedArticles.includes(article.link));
        } else {
            currentlyDisplayedArticles = masterArticleList.filter(article => article.source === selectedSource);
        }
        
        feedContainer.innerHTML = '';
        currentPage = 1;
        const initialArticles = currentlyDisplayedArticles.slice(0, ARTICLES_PER_PAGE);
        
        if (initialArticles.length === 0) {
            feedContainer.innerHTML = "<p>No articles found matching your criteria.</p>";
            loadMoreBtn.style.display = 'none';
            return;
        }

        renderArticles(initialArticles);
        
        if (currentlyDisplayedArticles.length > ARTICLES_PER_PAGE) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }

    function setupFilters() {
        const sources = ['All', 'Bookmarked', ...new Set(masterArticleList.map(article => article.source))];
        filterContainer.innerHTML = sources.map(source => 
            `<button class="filter-btn" data-source="${source}">${source}</button>`
        ).join('');
        
        const filterButtons = filterContainer.querySelectorAll('.filter-btn');
        filterButtons[0].classList.add('active');

        filterContainer.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    }

    // --- Initial Data Fetch ---
    async function loadNews() {
        loadBookmarks();
        try {
            const response = await fetch(NEWS_ENDPOINT);
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            
            masterArticleList = await response.json();
            currentlyDisplayedArticles = [...masterArticleList];
            
            loadingContainer.style.display = 'none';
            
            const initialArticles = currentlyDisplayedArticles.slice(0, ARTICLES_PER_PAGE);
            renderArticles(initialArticles);
            
            if(currentlyDisplayedArticles.length > ARTICLES_PER_PAGE) {
                loadMoreBtn.style.display = 'block';
            }

            setupFilters();

        } catch (error) {
            console.error("Failed to load news:", error);
            loadingContainer.innerHTML = `<p style="color: #d9534f;">Failed to load news feed. Please try again later.</p>`;
        }
    }

    loadNews();
});
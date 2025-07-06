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
        if (!articles || articles.length === 0) {
            feedContainer.innerHTML = "<p>No articles found matching your criteria.</p>";
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const item of articles) {
            const articleElement = document.createElement("div");
            articleElement.className = "article-card";
            const publicationDate = new Date(item.pubDate).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
            const imageUrl = (item.imageUrl && item.imageUrl.startsWith('http')) ? item.imageUrl : 'https://i.imgur.com/gY9V3sD.jpeg';

            articleElement.innerHTML = `
                <div class="card-image-container">
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                        <img src="${imageUrl}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://i.imgur.com/gY9V3sD.jpeg';">
                    </a>
                </div>
                <div class="card-content">
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

        // Hide button if no more articles
        if (endIndex >= currentlyDisplayedArticles.length) {
            loadMoreBtn.style.display = 'none';
        }
    }
    loadMoreBtn.addEventListener('click', loadMoreArticles);

    // --- Filtering Logic ---
    function applyFilters() {
        const activeFilterButton = filterContainer.querySelector('.filter-btn.active');
        const selectedSource = activeFilterButton ? activeFilterButton.dataset.source : 'All';

        if (selectedSource === 'All') {
            currentlyDisplayedArticles = [...masterArticleList];
        } else {
            currentlyDisplayedArticles = masterArticleList.filter(article => article.source === selectedSource);
        }
        
        // Reset view for the new filter
        feedContainer.innerHTML = '';
        currentPage = 1;
        const initialArticles = currentlyDisplayedArticles.slice(0, ARTICLES_PER_PAGE);
        renderArticles(initialArticles);
        
        // Show or hide "Load More" button based on new filtered list
        if (currentlyDisplayedArticles.length > ARTICLES_PER_PAGE) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }

    function setupFilters() {
        const sources = ['All', ...new Set(masterArticleList.map(article => article.source))];
        filterContainer.innerHTML = sources.map(source => 
            `<button class="filter-btn" data-source="${source}">${source}</button>`
        ).join('');
        
        const filterButtons = filterContainer.querySelectorAll('.filter-btn');
        filterButtons[0].classList.add('active'); // Activate "All" button

        filterContainer.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            applyFilters();
        });
    }

    // --- Initial Data Fetch ---
    async function loadNews() {
        try {
            const response = await fetch(NEWS_ENDPOINT);
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            
            masterArticleList = await response.json();
            currentlyDisplayedArticles = [...masterArticleList];
            
            loadingContainer.style.display = 'none'; // Hide skeletons
            
            // Initial render
            const initialArticles = currentlyDisplayedArticles.slice(0, ARTICLES_PER_PAGE);
            renderArticles(initialArticles);
            
            // Show "Load More" if needed
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
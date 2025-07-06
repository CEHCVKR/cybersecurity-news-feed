document.addEventListener("DOMContentLoaded", () => {
    const feedContainer = document.getElementById("news-feed-container");
    const loadingIndicator = document.getElementById("loading");
    const filterContainer = document.getElementById("filter-container");
    const searchInput = document.getElementById("search-input");

    const NEWS_ENDPOINT = "/.netlify/functions/getNews";
    
    let masterArticleList = []; // Holds all fetched articles

    function renderArticles(articles) {
        feedContainer.innerHTML = "";
        
        if (!articles || articles.length === 0) {
            feedContainer.innerHTML = "<p>No articles found matching your criteria.</p>";
            return;
        }

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
            feedContainer.appendChild(articleElement);
        }
    }

    // NEW: Combined function to handle both search and filter
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const activeFilterButton = filterContainer.querySelector('.filter-btn.active');
        const selectedSource = activeFilterButton ? activeFilterButton.dataset.source : 'All';

        let filteredArticles = masterArticleList;

        // 1. Filter by source
        if (selectedSource !== 'All') {
            filteredArticles = filteredArticles.filter(article => article.source === selectedSource);
        }

        // 2. Filter by search term
        if (searchTerm) {
            filteredArticles = filteredArticles.filter(article => 
                article.title.toLowerCase().includes(searchTerm) ||
                (article.description && article.description.toLowerCase().includes(searchTerm))
            );
        }

        renderArticles(filteredArticles);
    }

    function setupControls() {
        // --- Setup Filter Buttons ---
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

        // --- Setup Search Input ---
        searchInput.addEventListener('input', applyFilters);
    }

    async function loadNews() {
        try {
            loadingIndicator.style.display = 'block';
            const response = await fetch(NEWS_ENDPOINT);
            const articles = await response.json();
            
            masterArticleList = articles; // Save the full list
            
            loadingIndicator.style.display = 'none';
            renderArticles(masterArticleList); // Render all articles initially
            setupControls(); // Create the filter and search controls

        } catch (error) {
            console.error("Failed to load news:", error);
            loadingIndicator.textContent = "Failed to load news feed.";
            loadingIndicator.style.color = "#d9534f";
        }
    }

    loadNews();
});
document.addEventListener("DOMContentLoaded", () => {
    const feedContainer = document.getElementById("news-feed-container");
    const loadingIndicator = document.getElementById("loading");

    // This is the endpoint for our helper function.
    const NEWS_ENDPOINT = "/.netlify/functions/getNews";

    function renderArticles(articles) {
        feedContainer.innerHTML = "";
        
        if (!articles || articles.length === 0) {
            loadingIndicator.textContent = "Could not load news feed. Please try again later.";
            loadingIndicator.style.display = 'block';
            return;
        }

        for (const item of articles) {
            const articleElement = document.createElement("div");
            articleElement.className = "article-card";
            
            const publicationDate = new Date(item.pubDate).toLocaleDateString("en-US", { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            // Use a placeholder if the imageUrl is missing or invalid
            const imageUrl = item.imageUrl && item.imageUrl.startsWith('http') ? item.imageUrl : 'https://i.imgur.com/gY9V3sD.jpeg';

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
                </div>
            `;
            feedContainer.appendChild(articleElement);
        }
    }

    async function loadNews() {
        try {
            const response = await fetch(NEWS_ENDPOINT);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            const articles = await response.json();
            loadingIndicator.style.display = 'none';
            renderArticles(articles);
        } catch (error) {
            console.error("Failed to load news:", error);
            loadingIndicator.textContent = "Failed to load news feed. Check the terminal for errors.";
            loadingIndicator.style.color = "#d9534f";
        }
    }

    loadNews();
});
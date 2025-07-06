const Parser = require('rss-parser');
const parser = new Parser();

// --- IMPROVEMENT: Simple In-Memory Cache ---
let cache = {
  timestamp: null,
  data: null,
};
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const NEWS_API_KEY = "ad964397fdc54f008b9762b9bca992a2";

const rssFeeds = [
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss_simple.asp" },
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml" },
    { name: "NIST NVD (CVEs)", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml" },
    { name: "Securelist (Kaspersky)", url: "https://securelist.com/feed" },
    { name: "Threatpost", url: "https://threatpost.com/feed/" },
    { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/" },
];

async function fetchAllNews() {
    // Check if we have valid, recent data in the cache
    if (cache.data && (Date.now() - cache.timestamp < CACHE_DURATION_MS)) {
        console.log("Serving news from cache.");
        return cache.data;
    }
    console.log("Fetching fresh news from all sources.");

    // The rest of the fetching logic...
    const rssPromises = rssFeeds.map(feed => parser.parseURL(feed.url)
        .then(parsedFeed => (parsedFeed.items || []).map(item => ({ source: feed.name, title: item.title, link: item.link, pubDate: item.isoDate || item.pubDate, description: (item.contentSnippet || "").substring(0, 150) + '...' })))
        .catch(() => [])
    );
    
    const query = '("data breach" OR "security breach" OR "hacked" OR "vulnerability" OR "cyberattack" OR "ransomware")';
    const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;
    const newsApiPromise = fetch(newsApiUrl).then(res => res.json()).then(data => (data.articles || []).map(article => ({ source: article.source.name, title: article.title, link: article.url, pubDate: article.publishedAt, description: article.description || ""}))).catch(() => []);

    const allResults = await Promise.allSettled([...rssPromises, newsApiPromise]);
    let combinedNews = allResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
    
    // Sort before caching
    combinedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    // Save the fresh results to the cache
    cache = {
        timestamp: Date.now(),
        data: combinedNews,
    };
    
    return combinedNews;
}

exports.handler = async function(event, context) {
    try {
        const allNews = await fetchAllNews();
        if (!allNews || allNews.length === 0) {
            throw new Error("Could not fetch any news.");
        }
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentNews = allNews.filter(article => new Date(article.pubDate) >= oneWeekAgo);

        return {
            statusCode: 200,
            body: JSON.stringify(recentNews),
        };
    } catch (error) {
        console.error("Handler Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch news feed" }),
        };
    }
};
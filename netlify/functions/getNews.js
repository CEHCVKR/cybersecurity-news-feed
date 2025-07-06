const Parser = require('rss-parser');
const parser = new Parser();

// Your API key is kept securely on the server
const NEWS_API_KEY = "ad964397fdc54f008b9762b9bca992a2";

// List of RSS feeds to parse
const rssFeeds = [
    // Core News
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss_simple.asp" },
    // Official Alerts & CVEs
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml" },
    { name: "NIST NVD (CVEs)", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml" },
    // Deep-Dive Analysis
    { name: "Securelist (Kaspersky)", url: "https://securelist.com/feed" },
    { name: "Threatpost", url: "https://threatpost.com/feed/" },
    { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/" },
];

/**
 * **IMPROVEMENT:** This function is now much better at finding images.
 * It checks multiple fields and uses a robust regex to find the first <img> tag.
 */
function extractImageUrl(item) {
    // 1. Check for dedicated media tags first, as they are often higher quality
    if (item.enclosure && item.enclosure.url && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    
    // 2. Look inside the full content for an <img> tag. This is key for Krebs, BleepingComputer etc.
    const content = item['content:encoded'] || item.content || '';
    const match = content.match(/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        return match[1];
    }

    // 3. Fallback for other potential media tags
    const mediaContent = item['media:content'];
    if (mediaContent && mediaContent.$ && mediaContent.$.url) {
        return mediaContent.$.url;
    }
    
    // 4. If no image is found after all checks, return the placeholder
    return "https://i.imgur.com/gY9V3sD.jpeg";
}


// --- Function to fetch and parse standard RSS feeds ---
async function fetchRss(feed) {
    try {
        // We pass custom fields to the parser to ensure it grabs 'content:encoded'
        const customParser = new Parser({
            customFields: {
                item: [['content:encoded', 'content:encoded']]
            }
        });
        const parsedFeed = await customParser.parseURL(feed.url);

        return (parsedFeed.items || []).map(item => ({
            source: feed.name,
            title: item.title,
            link: item.link,
            pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
            description: (item.contentSnippet || item.content || '').replace(/<[^>]*>?/gm, '').substring(0, 150) + '...',
            imageUrl: extractImageUrl(item)
        }));
    } catch (error) {
        console.error(`ERROR fetching RSS feed: ${feed.name}`, error.message);
        return [];
    }
}

// --- Function to fetch from the general News API ---
async function fetchNewsApi() {
    try {
        const query = '("data breach" OR "security breach" OR "hacked" OR "vulnerability" OR "cyberattack" OR "ransomware" OR "malware")';
        const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;
        const response = await fetch(newsApiUrl);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.articles || []).map(article => ({
            source: article.source.name,
            title: article.title,
            link: article.url,
            pubDate: article.publishedAt,
            description: article.description || "",
            imageUrl: article.urlToImage || "https://i.imgur.com/gY9V3sD.jpeg"
        }));
    } catch (error) {
        console.error('FATAL ERROR fetching from News API:', error.message);
        return [];
    }
}

// --- Function to fetch from CISA's Known Exploited Vulnerabilities catalog ---
async function fetchCisaKevs() {
    try {
        const cisaUrl = 'https://www.cisa.gov/known-exploited-vulnerabilities.json';
        const response = await fetch(cisaUrl);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.vulnerabilities || []).map(vuln => ({
            source: "CISA KEV",
            title: `Exploited: ${vuln.vulnerabilityName}`,
            link: `https://nvd.nist.gov/vuln/detail/${vuln.cveID}`,
            pubDate: vuln.dateAdded,
            description: `${vuln.shortDescription} | Required Action: ${vuln.requiredAction}`,
            imageUrl: "https://i.imgur.com/gY9V3sD.jpeg" // CISA KEV feed has no images
        }));
    } catch (error) {
        console.error('FATAL ERROR fetching from CISA KEV:', error.message);
        return [];
    }
}

// --- Function to fetch live malware C2 servers from Feodo Tracker ---
async function fetchFeodoTracker() {
    try {
        const feodoUrl = 'https://feodotracker.abuse.ch/downloads/json/24h/';
        const response = await fetch(feodoUrl);
        if (!response.ok) return [];
        const data = await response.json();
        return (data || []).map(threat => ({
            source: "Feodo Tracker",
            title: `Active C2 Server Detected: ${threat.ip_address}:${threat.port}`,
            link: `https://feodotracker.abuse.ch/host/${threat.ip_address}/`,
            pubDate: threat.first_seen_utc,
            description: `Malware family: ${threat.malware_family}. Status: ${threat.c2_status}. Country: ${threat.country}.`,
            imageUrl: "https://i.imgur.com/gY9V3sD.jpeg" // Feodo tracker has no images
        }));
    } catch (error) {
        console.error('FATAL ERROR fetching from Feodo Tracker:', error.message);
        return [];
    }
}


// --- Main serverless function handler ---
exports.handler = async function(event, context) {
    try {
        const allFetchPromises = [
            ...rssFeeds.map(feed => fetchRss(feed)),
            fetchNewsApi(),
            fetchCisaKevs(),
            fetchFeodoTracker() 
        ];

        const allResults = await Promise.allSettled(allFetchPromises);
        
        const combinedNews = allResults
            .filter(result => result.status === 'fulfilled' && result.value)
            .flatMap(result => result.value);

        if (combinedNews.length === 0) {
            throw new Error("Could not fetch any news from any source.");
        }
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentNews = combinedNews.filter(article => new Date(article.pubDate) >= oneWeekAgo);

        recentNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

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
const Parser = require('rss-parser');
const parser = new Parser();

// --- List of keywords to ensure relevance from broader tech sites ---
const CYBERSECURITY_KEYWORDS = [
    'security', 'cybersecurity', 'vulnerability', 'vulnerabilities', 'hacked', 
    'malware', 'ransomware', 'phishing', 'breach', 'cyberattack', 'exploit', 
    'zero-day', 'threat', 'cve', 'cis', 'nist'
];

// --- Curated list of RSS Feeds ---
// Feeds are now separated into "pure" security feeds and general tech feeds that need filtering.
const pureSecurityFeeds = [
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss_simple.asp" },
    { name: "Threatpost", url: "https://threatpost.com/feed/" },
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml" },
    { name: "NIST NVD (CVEs)", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml" },
    { name: "Securelist (Kaspersky)", url: "https://securelist.com/feed" },
    { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/" }
];

const generalTechFeeds = [
    // **IMPROVEMENT:** Using the specific "Security" feed from these sites where available.
    { name: "WIRED Security", url: "https://www.wired.com/feed/category/security/latest/rss" },
    { name: "Ars Technica Security", url: "https://feeds.arstechnica.com/arstechnica/security" },
    { name: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml" }
];


// --- Main function to fetch and parse RSS feeds ---
async function fetchRss(feed, applyKeywordFilter = false) {
    try {
        const customParser = new Parser({
            customFields: { item: [['content:encoded', 'content:encoded']] }
        });
        const parsedFeed = await customParser.parseURL(feed.url);

        let items = (parsedFeed.items || []);

        // **IMPROVEMENT:** Apply keyword filter for general tech news feeds
        if (applyKeywordFilter) {
            items = items.filter(item => {
                const title = item.title.toLowerCase();
                return CYBERSECURITY_KEYWORDS.some(keyword => title.includes(keyword));
            });
        }

        return items.map(item => ({
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

function extractImageUrl(item) {
    if (item.enclosure && item.enclosure.url && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    const content = item['content:encoded'] || item.content || '';
    const match = content.match(/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        return match[1];
    }
    return "https://i.imgur.com/gY9V3sD.jpeg"; // Fallback placeholder
}


// --- Main serverless function handler ---
exports.handler = async function(event, context) {
    try {
        // Fetch from pure security feeds without extra filtering
        const purePromises = pureSecurityFeeds.map(feed => fetchRss(feed, false));
        // Fetch from general tech feeds and apply our keyword filter
        const generalPromises = generalTechFeeds.map(feed => fetchRss(feed, true));

        const allFetchPromises = [...purePromises, ...generalPromises];
        const allResults = await Promise.allSettled(allFetchPromises);
        
        const combinedNews = allResults
            .filter(result => result.status === 'fulfilled' && result.value)
            .flatMap(result => result.value);

        if (combinedNews.length === 0) {
            throw new Error("Could not fetch any news from any source.");
        }
        
        // Filter for articles published in the last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentNews = combinedNews.filter(article => new Date(article.pubDate) >= oneWeekAgo);

        // Sort the final list by date
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
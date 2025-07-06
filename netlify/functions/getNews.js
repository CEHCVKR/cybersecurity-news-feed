const Parser = require('rss-parser');
const parser = new Parser();

const rssFeeds = [
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss_simple.asp" },
    { name: "WIRED Security", url: "https://www.wired.com/feed/category/security/latest/rss" },
    { name: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml" },
    { name: "Ars Technica Security", url: "https://feeds.arstechnica.com/arstechnica/security" },
];

// --- Main serverless function handler ---
exports.handler = async function(event, context) {
    try {
        const fetchPromises = rssFeeds.map(fetchRss);
        const results = await Promise.allSettled(fetchPromises);
        
        let combinedNews = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .flatMap(result => result.value);

        if (combinedNews.length === 0) {
            throw new Error("Could not fetch any news from any source.");
        }
        
        combinedNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        return {
            statusCode: 200,
            body: JSON.stringify(combinedNews),
        };

    } catch (error) {
        console.error("Handler Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch news feed" }),
        };
    }
};

// --- Helper functions for parsing RSS and finding images ---
async function fetchRss(feed) {
    try {
        const customParser = new Parser({
            customFields: { item: [['content:encoded', 'content:encoded']] }
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

function extractImageUrl(item) {
    if (item.enclosure && item.enclosure.url && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    const content = item['content:encoded'] || item.content || '';
    const match = content.match(/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
        return match[1];
    }
    return "https://i.imgur.com/gY9V3sD.jpeg";
}
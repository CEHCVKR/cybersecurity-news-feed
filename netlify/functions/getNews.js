const Parser = require('rss-parser');
const parser = new Parser();

const rssFeeds = [
    // Core Security Blogs
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "Bleeping Computer", url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss_simple.asp" },
    
    // Official Alerts & Vulnerabilities
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml" },
    { name: "NIST NVD (CVEs)", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml" },
    { name: "Zero Day Initiative", url: "https://www.zerodayinitiative.com/rss/published/" }, // New
    
    // Respected Tech News Security Sections
    { name: "WIRED Security", url: "https://www.wired.com/feed/category/security/latest/rss" },
    { name: "Ars Technica Security", url: "https://feeds.arstechnica.com/arstechnica/security" },
    { name: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml" },
    
    // Deep-Dive & Malware Analysis
    { name: "Securelist (Kaspersky)", url: "https://securelist.com/feed" },
    { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/" },
    { name: "Google's Threat Analysis Group", url: "https://blog.google/threat-analysis-group/rss/" }, // New

    // Cyber Crime & Hacking News
    { name: "Threatpost", url: "https://threatpost.com/feed/" },
    { name: "HackRead", url: "https://www.hackread.com/feed/" }, // New
    { name: "GBHackers on Security", url: "https://gbhackers.com/feed/" }, // New
    { name: "IT Security Guru", url: "https://www.itsecurityguru.org/feed/" }, // New
];

// --- Function to fetch and parse standard RSS feeds ---
async function fetchRss(feed, applyKeywordFilter = false) {
    try {
        const customParser = new Parser({
            customFields: { item: [['content:encoded', 'content:encoded']] }
        });
        const parsedFeed = await customParser.parseURL(feed.url);

        let items = (parsedFeed.items || []);

        if (applyKeywordFilter) {
            const CYBERSECURITY_KEYWORDS = ['security', 'vulnerability', 'hacked', 'malware', 'ransomware', 'phishing', 'breach', 'cyberattack', 'exploit', 'zero-day', 'threat', 'cve'];
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
        const allFetchPromises = rssFeeds.map(feed => fetchRss(feed));

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
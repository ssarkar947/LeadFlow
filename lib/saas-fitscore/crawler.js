/**
 * SaaS FitScore — Website Crawler
 * Primary Engine: Firecrawl API
 * Resilient Fallback: SSRF-Guarded Native HTTP Extractor
 * Maximum 10 pages per assessment
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { validateUrlForSSRF, isSameOrSubDomain } = require('./ssrf-guard');

const MAX_PAGES_DEFAULT = 10;
const MAX_RAW_BYTES = 2 * 1024 * 1024; // 2 MB response limit
const REQUEST_TIMEOUT_MS = 8000;

// Priority path keywords for discovering relevant SaaS commercial pages
const PRIORITY_KEYWORDS = [
  'pricing', 'price', 'plans', 'tier',
  'feature', 'features', 'product', 'platform', 'capabilities',
  'solution', 'solutions', 'use-case', 'use-cases',
  'about', 'company',
  'case-stud', 'customer', 'customers', 'story', 'stories',
  'faq', 'help',
  'integration', 'integrations', 'ecosystem',
  'doc', 'docs', 'guide'
];

/**
 * Strips HTML tags and extracts clean text while preserving structure
 */
function extractHtmlText(html) {
  if (!html) return { title: '', text: '', links: [] };

  // 1. Extract Title
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 2. Extract internal links from <a> tags
  const links = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:') && !rawHref.startsWith('mailto:') && !rawHref.startsWith('tel:')) {
      links.push(rawHref);
    }
  }

  // 3. Remove script, style, svg, noscript, comments
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ');

  // 4. Format headings & structural breaks
  cleaned = cleaned
    .replace(/<\/(h[1-6]|p|div|section|li|tr|header|footer)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // 5. Decode HTML entities and normalize whitespace
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  // Cap extracted content to 60 KB to prevent token bloating
  const truncatedText = cleaned.slice(0, 60000);

  return { title, text: truncatedText, links };
}

/**
 * Fetch a single URL safely with SSRF protection and redirect following
 */
async function fetchSafeUrl(targetUrl, redirectDepth = 0) {
  if (redirectDepth > 3) {
    throw new Error('Too many redirects (exceeded limit of 3)');
  }

  // 1. SSRF Validation
  const ssrfCheck = await validateUrlForSSRF(targetUrl);
  if (!ssrfCheck.valid) {
    throw new Error(`SSRF blocked for URL '${targetUrl}': ${ssrfCheck.reason}`);
  }

  const parsed = ssrfCheck.parsedUrl;
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(
      targetUrl,
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AdsViseSaaSFitScore/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (res) => {
        // Handle Redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          res.resume(); // discard data
          return resolve(fetchSafeUrl(redirectUrl, redirectDepth + 1));
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage}`));
        }

        // Validate Content-Type
        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          res.resume();
          return resolve({ rawHtml: '', isHtml: false });
        }

        let rawData = '';
        let byteCount = 0;

        res.on('data', (chunk) => {
          byteCount += chunk.length;
          if (byteCount > MAX_RAW_BYTES) {
            req.destroy(new Error(`Response exceeded maximum size of ${MAX_RAW_BYTES} bytes`));
            return;
          }
          rawData += chunk.toString();
        });

        res.on('end', () => {
          resolve({ rawHtml: rawData, isHtml: true });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Score candidate link relevance for SaaS growth evaluation
 */
function scoreLinkRelevance(href) {
  const lower = href.toLowerCase();
  for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
    const kw = PRIORITY_KEYWORDS[i];
    if (lower.includes(kw)) {
      // Pricing and features are given top priority
      if (kw === 'pricing' || kw === 'price' || kw === 'plans') return 100;
      if (kw === 'feature' || kw === 'features' || kw === 'product') return 90;
      if (kw === 'solution' || kw === 'solutions') return 80;
      return 50 - i;
    }
  }
  return 0;
}

/**
 * Native HTTP Crawler Fallback
 */
async function crawlViaHttpFallback(rootUrl, maxPages = MAX_PAGES_DEFAULT) {
  const results = [];
  const visited = new Set();
  const queue = [{ url: rootUrl, priority: 1000 }];

  const baseDomain = new URL(rootUrl).hostname;

  while (queue.length > 0 && results.length < maxPages) {
    // Sort queue by priority descending
    queue.sort((a, b) => b.priority - a.priority);
    const current = queue.shift();

    let normalizedUrl;
    try {
      const u = new URL(current.url);
      u.hash = ''; // strip anchor
      normalizedUrl = u.toString().replace(/\/$/, '');
    } catch {
      continue;
    }

    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    const crawlRecord = {
      url: normalizedUrl,
      pageTitle: '',
      extractedContent: '',
      crawlStatus: 'pending',
      timestamp: new Date().toISOString(),
      sourceType: 'http_fallback',
      errorDetails: null
    };

    try {
      console.log(`[Crawler HTTP] Fetching: ${normalizedUrl}`);
      const fetchRes = await fetchSafeUrl(normalizedUrl);

      if (fetchRes.isHtml && fetchRes.rawHtml) {
        const { title, text, links } = extractHtmlText(fetchRes.rawHtml);
        crawlRecord.pageTitle = title;
        crawlRecord.extractedContent = text;
        crawlRecord.crawlStatus = 'success';
        results.push(crawlRecord);

        // Discover and enqueue new same-domain links
        for (const rawHref of links) {
          try {
            const absoluteUrl = new URL(rawHref, normalizedUrl).toString();
            if (isSameOrSubDomain(absoluteUrl, baseDomain)) {
              const cleanHref = new URL(absoluteUrl);
              cleanHref.hash = '';
              const cleanStr = cleanHref.toString().replace(/\/$/, '');
              if (!visited.has(cleanStr) && !queue.some(q => q.url === cleanStr)) {
                const priority = scoreLinkRelevance(cleanStr);
                if (priority > 0 || queue.length < maxPages * 2) {
                  queue.push({ url: cleanStr, priority });
                }
              }
            }
          } catch {
            // Ignore invalid child URL
          }
        }
      } else {
        crawlRecord.crawlStatus = 'skipped_non_html';
        results.push(crawlRecord);
      }
    } catch (crawlErr) {
      console.warn(`[Crawler Warning] Failed fetching ${normalizedUrl}:`, crawlErr.message);
      crawlRecord.crawlStatus = 'failed';
      crawlRecord.errorDetails = crawlErr.message;
      results.push(crawlRecord);
    }
  }

  return results;
}

/**
 * Crawl using Firecrawl API if configured
 */
async function crawlViaFirecrawl(rootUrl, apiKey, maxPages = MAX_PAGES_DEFAULT) {
  console.log(`[Crawler] Attempting Firecrawl API crawl for: ${rootUrl}`);

  // Validate root URL with SSRF guard first
  const ssrf = await validateUrlForSSRF(rootUrl);
  if (!ssrf.valid) {
    throw new Error(`SSRF blocked for Firecrawl root URL: ${ssrf.reason}`);
  }

  // Firecrawl scrape / crawl endpoint
  const firecrawlEndpoint = 'https://api.firecrawl.dev/v1/crawl';
  
  const payload = JSON.stringify({
    url: rootUrl,
    limit: maxPages,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: true
    }
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  // We make request to Firecrawl
  const response = await fetch(firecrawlEndpoint, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Firecrawl API error HTTP ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  
  // If Firecrawl returns immediate or async job
  if (data.data && Array.isArray(data.data)) {
    return data.data.slice(0, maxPages).map(item => ({
      url: item.metadata?.sourceURL || item.url || rootUrl,
      pageTitle: item.metadata?.title || '',
      extractedContent: (item.markdown || item.content || '').slice(0, 60000),
      crawlStatus: 'success',
      timestamp: new Date().toISOString(),
      sourceType: 'firecrawl',
      errorDetails: null
    }));
  }

  // If async jobId was returned, check or fallback
  if (data.id) {
    // For fast synchronous pipeline without long webhook waits, query status once
    const statusRes = await fetch(`https://api.firecrawl.dev/v1/crawl/${data.id}`, { headers });
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.data && Array.isArray(statusData.data)) {
        return statusData.data.slice(0, maxPages).map(item => ({
          url: item.metadata?.sourceURL || item.url,
          pageTitle: item.metadata?.title || '',
          extractedContent: (item.markdown || item.content || '').slice(0, 60000),
          crawlStatus: 'success',
          timestamp: new Date().toISOString(),
          sourceType: 'firecrawl',
          errorDetails: null
        }));
      }
    }
  }

  throw new Error('Firecrawl returned no immediate crawl results');
}

/**
 * Main Public Crawl Function
 * Automatically uses Firecrawl if API key is configured, else falls back to safe HTTP crawler
 */
async function crawlSaaSWebsite(rootUrl, maxPages = MAX_PAGES_DEFAULT) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    try {
      const firecrawlResults = await crawlViaFirecrawl(rootUrl, apiKey, maxPages);
      if (firecrawlResults && firecrawlResults.length > 0) {
        return {
          success: true,
          sourceType: 'firecrawl',
          pagesCrawled: firecrawlResults.length,
          pages: firecrawlResults
        };
      }
    } catch (firecrawlErr) {
      console.warn('[Crawler] Firecrawl failed or timed out. Falling back to native SSRF-guarded HTTP extractor:', firecrawlErr.message);
    }
  }

  // Fallback
  const fallbackPages = await crawlViaHttpFallback(rootUrl, maxPages);
  const successfulCount = fallbackPages.filter(p => p.crawlStatus === 'success').length;

  return {
    success: successfulCount > 0,
    sourceType: 'http_fallback',
    pagesCrawled: successfulCount,
    pages: fallbackPages
  };
}

module.exports = {
  crawlSaaSWebsite,
  fetchSafeUrl,
  extractHtmlText
};

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

// Target categories explicitly specified in the implementation prompt:
// Homepage, Pricing, Features, Product, Solutions, About, Case studies, FAQ, Integrations, Documentation
const PROMPT_TARGET_CATEGORIES = [
  {
    category: 'homepage',
    priority: 100,
    patterns: [/^\/?$/i]
  },
  {
    category: 'pricing',
    priority: 95,
    patterns: [/pricing/i, /price/i, /plans/i, /tier/i, /subscription/i]
  },
  {
    category: 'features',
    priority: 90,
    patterns: [/features?/i, /capabilities/i, /whats-new/i]
  },
  {
    category: 'product',
    priority: 85,
    patterns: [/product/i, /platform/i, /how-it-works/i, /overview/i]
  },
  {
    category: 'solutions',
    priority: 80,
    patterns: [/solutions?/i, /use-cases?/i, /for-[a-z0-9-]+/i, /industries/i]
  },
  {
    category: 'case_studies',
    priority: 75,
    patterns: [/case-stud(y|ies)/i, /customers?/i, /stories/i, /testimonials?/i, /work(\/|$)/i]
  },
  {
    category: 'integrations',
    priority: 70,
    patterns: [/integrations?/i, /ecosystem/i, /connectors?/i, /apps/i]
  },
  {
    category: 'about',
    priority: 65,
    patterns: [/about(-us)?/i, /company/i, /our-story/i, /mission/i]
  },
  {
    category: 'faq',
    priority: 60,
    patterns: [/faqs?/i, /frequently-asked-questions/i, /help/i]
  },
  {
    category: 'documentation',
    priority: 55,
    patterns: [/docs?/i, /documentation/i, /guides?/i, /api-docs/i]
  }
];

// Strict exclusions: do NOT crawl blogs, legal, careers, accounts, etc.
const EXCLUDED_PATTERNS = [
  /\/blog(\/|$)/i, /\/posts?(\/|$)/i, /\/news(\/|$)/i, /\/articles?(\/|$)/i,
  /\/tag(\/|$)/i, /\/tags(\/|$)/i, /\/category(\/|$)/i, /\/categories(\/|$)/i, /\/author(\/|$)/i,
  /\/privacy(-policy)?(\.html)?$/i, /\/terms(-of-service)?(\.html)?$/i, /\/legal(\/|$)/i, /\/cookies?(\/|$)/i,
  /\/security(\/|$)/i, /\/compliance(\/|$)/i, /\/gdpr(\/|$)/i,
  /\/careers?(\/|$)/i, /\/jobs?(\/|$)/i, /\/openings?(\/|$)/i, /\/team(\/|$)/i,
  /\/press(\/|$)/i, /\/media(-kit)?(\/|$)/i, /\/events?(\/|$)/i, /\/webinars?(\/|$)/i,
  /\/login(\/|$)/i, /\/signin(\/|$)/i, /\/signup(\/|$)/i, /\/register(\/|$)/i,
  /\/app(\/|$)/i, /\/dashboard(\/|$)/i, /\/auth(\/|$)/i, /\/portal(\/|$)/i,
  /\/status(\/|$)/i, /\/changelog(\/|$)/i, /\/updates(\/|$)/i, /\/roadmap(\/|$)/i,
  /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|gz|tar|mp4|webm|css|js|json|xml|ico)$/i
];

/**
 * Filter and select ONLY candidate URLs belonging to the 10 target categories
 * Rejects all blog, legal, terms, careers, account, and unrelated subpages
 */
function selectTargetedSaaSUrls(rootUrl, candidateUrls = [], maxPages = MAX_PAGES_DEFAULT) {
  let rootClean;
  let baseDomain;
  try {
    const u = new URL(rootUrl);
    u.hash = '';
    baseDomain = u.hostname;
    rootClean = u.toString().replace(/\/$/, '');
  } catch {
    return [{ category: 'homepage', url: rootUrl, priority: 100 }];
  }

  const selectedMap = new Map();
  // Always include homepage
  selectedMap.set('homepage', { url: rootClean, priority: 100, depth: 0 });

  const allUrls = [rootClean, ...candidateUrls];

  for (const raw of allUrls) {
    if (!raw) continue;
    let normalized;
    try {
      const u = new URL(raw, rootUrl);
      u.hash = '';
      if (!isSameOrSubDomain(u.toString(), baseDomain)) continue;
      normalized = u.toString().replace(/\/$/, '');
    } catch {
      continue;
    }

    // Check strict exclusions
    if (EXCLUDED_PATTERNS.some(p => p.test(normalized))) {
      continue;
    }

    let pathname = '/';
    try {
      pathname = new URL(normalized).pathname;
    } catch {}

    const depth = pathname.split('/').filter(Boolean).length;

    // Match against prompt target categories
    for (const cat of PROMPT_TARGET_CATEGORIES) {
      if (cat.category === 'homepage') continue;
      if (cat.patterns.some(p => p.test(pathname))) {
        const existing = selectedMap.get(cat.category);
        // Prefer shorter, cleaner path depth (e.g. /pricing over /pricing/enterprise/tier2)
        if (!existing || depth < existing.depth) {
          selectedMap.set(cat.category, { url: normalized, priority: cat.priority, depth });
        }
        break;
      }
    }
  }

  // Sort by category priority descending and limit to maxPages
  return Array.from(selectedMap.entries())
    .map(([cat, info]) => ({ category: cat, url: info.url, priority: info.priority }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxPages);
}

/**
 * Discover candidate URLs using Firecrawl /v1/map, falling back to homepage link extraction
 */
async function discoverCandidateUrls(rootUrl, apiKey) {
  const discovered = [];

  // Try Firecrawl map API first
  if (apiKey) {
    try {
      console.log(`[Crawler Firecrawl] Discovering site structure via Firecrawl map for: ${rootUrl}`);
      const mapRes = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ url: rootUrl, limit: 100 }),
        signal: AbortSignal.timeout(8000)
      });

      if (mapRes.ok) {
        const mapData = await mapRes.json();
        if (mapData.links && Array.isArray(mapData.links)) {
          discovered.push(...mapData.links);
          console.log(`[Crawler Firecrawl] Map discovered ${mapData.links.length} total URLs on domain.`);
          return discovered;
        }
      }
    } catch (mapErr) {
      console.warn('[Crawler Firecrawl Warning] Map call skipped or timed out:', mapErr.message);
    }
  }

  // Fallback: Fetch root URL HTML directly and extract internal navigation links
  try {
    const rootFetch = await fetchSafeUrl(rootUrl);
    if (rootFetch.isHtml && rootFetch.rawHtml) {
      const { links } = extractHtmlText(rootFetch.rawHtml);
      discovered.push(...links);
      console.log(`[Crawler Fallback] Extracted ${links.length} internal links from homepage navigation.`);
    }
  } catch (rootErr) {
    console.warn('[Crawler Fallback Warning] Failed fetching homepage links:', rootErr.message);
  }

  return discovered;
}

/**
 * Scrape a single URL with Firecrawl, falling back to safe native HTTP
 */
async function scrapeSinglePage(target, apiKey) {
  const result = {
    url: target.url,
    pageTitle: '',
    extractedContent: '',
    crawlStatus: 'pending',
    timestamp: new Date().toISOString(),
    sourceType: 'firecrawl',
    pageCategory: target.category,
    errorDetails: null
  };

  // SSRF Check
  const ssrf = await validateUrlForSSRF(target.url);
  if (!ssrf.valid) {
    result.crawlStatus = 'blocked_ssrf';
    result.errorDetails = ssrf.reason;
    return result;
  }

  // 1. Try Firecrawl Scrape if key available
  if (apiKey) {
    try {
      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          url: target.url,
          formats: ['markdown'],
          onlyMainContent: true
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (scrapeRes.ok) {
        const scrapeData = await scrapeRes.json();
        const doc = scrapeData.data;
        if (doc) {
          result.pageTitle = doc.metadata?.title || target.category;
          result.extractedContent = (doc.markdown || doc.content || '').slice(0, 60000);
          result.crawlStatus = 'success';
          result.sourceType = 'firecrawl';
          return result;
        }
      }
    } catch (fcErr) {
      console.warn(`[Crawler Warning] Firecrawl scrape failed for ${target.url} (${fcErr.message}), falling back to HTTP.`);
    }
  }

  // 2. Safe Native HTTP Fallback for this single URL
  try {
    const httpRes = await fetchSafeUrl(target.url);
    if (httpRes.isHtml && httpRes.rawHtml) {
      const { title, text } = extractHtmlText(httpRes.rawHtml);
      result.pageTitle = title || target.category;
      result.extractedContent = text;
      result.crawlStatus = 'success';
      result.sourceType = 'http_fallback';
    } else {
      result.crawlStatus = 'skipped_non_html';
    }
  } catch (err) {
    result.crawlStatus = 'failed';
    result.errorDetails = err.message;
  }

  return result;
}

/**
 * Crawl ONLY the pages needed and mentioned in the implementation prompt
 * Using Firecrawl as primary engine with SSRF-safe HTTP fallback
 */
async function crawlViaFirecrawl(rootUrl, apiKey, maxPages = MAX_PAGES_DEFAULT) {
  console.log(`[Crawler Firecrawl] Starting targeted prompt-scoped crawl for: ${rootUrl}`);

  // 1. Discover Candidate URLs
  const candidateUrls = await discoverCandidateUrls(rootUrl, apiKey);

  // 2. Filter strictly to target categories (Homepage, Pricing, Features, Product, Solutions, Case Studies, FAQ, Integrations, About, Docs)
  const targetedList = selectTargetedSaaSUrls(rootUrl, candidateUrls, maxPages);
  console.log(`[Crawler Firecrawl] Selected ${targetedList.length} targeted commercial pages:`);
  targetedList.forEach(t => console.log(`   • [${t.category.toUpperCase()}] ${t.url}`));

  // 3. Scrape selected pages with controlled concurrency (3 parallel requests)
  const results = [];
  const concurrency = 3;

  for (let i = 0; i < targetedList.length; i += concurrency) {
    const chunk = targetedList.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(target => scrapeSinglePage(target, apiKey)));
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Native HTTP Crawler Fallback (strictly scoped to the same 10 target categories)
 */
async function crawlViaHttpFallback(rootUrl, maxPages = MAX_PAGES_DEFAULT) {
  console.log(`[Crawler HTTP Fallback] Starting targeted prompt-scoped crawl for: ${rootUrl}`);

  // 1. Discover links from homepage HTML
  const candidateUrls = await discoverCandidateUrls(rootUrl, null);

  // 2. Filter strictly to prompt target categories
  const targetedList = selectTargetedSaaSUrls(rootUrl, candidateUrls, maxPages);
  console.log(`[Crawler HTTP Fallback] Selected ${targetedList.length} targeted commercial pages.`);

  // 3. Scrape via native HTTP
  const results = [];
  for (const target of targetedList) {
    const res = await scrapeSinglePage(target, null);
    results.push(res);
  }

  return results;
}

/**
 * Main Public Crawl Function
 * Automatically uses Firecrawl if API key is configured, else falls back to safe HTTP crawler
 * Crawls ONLY the pages needed and mentioned in the implementation prompt (max 10 pages)
 */
async function crawlSaaSWebsite(rootUrl, maxPages = MAX_PAGES_DEFAULT) {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    try {
      const firecrawlResults = await crawlViaFirecrawl(rootUrl, apiKey, maxPages);
      const successfulCount = firecrawlResults.filter(p => p.crawlStatus === 'success').length;
      if (successfulCount > 0) {
        return {
          success: true,
          sourceType: 'firecrawl',
          pagesCrawled: successfulCount,
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
  extractHtmlText,
  selectTargetedSaaSUrls,
  PROMPT_TARGET_CATEGORIES,
  EXCLUDED_PATTERNS
};

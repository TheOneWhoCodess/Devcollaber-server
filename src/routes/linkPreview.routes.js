const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const dns = require('dns').promises;

// In-memory cache — keyed by URL, avoids re-fetching (and re-exposing the
// server to a live request) every time a profile with the same portfolio
// link gets viewed. Fine for a single-instance server; if you run multiple
// server instances behind a load balancer, swap this for Redis so the
// cache is shared instead of per-instance.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map(); // url -> { data, expiresAt }

const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for an HTML head, avoids reading a huge page fully

// --- SSRF guards -----------------------------------------------------
// A "portfolio URL" is arbitrary user input that this endpoint fetches
// FROM THE SERVER. Without these checks, someone could set their
// portfolio URL to an internal service, localhost, or a cloud metadata
// endpoint (169.254.169.254) and use this route to probe your infra.

const isPrivateOrReservedIp = (ip) => {
    // IPv4 checks
    if (/^127\./.test(ip)) return true; // loopback
    if (/^10\./.test(ip)) return true; // private
    if (/^192\.168\./.test(ip)) return true; // private
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true; // private
    if (/^169\.254\./.test(ip)) return true; // link-local — includes cloud metadata (169.254.169.254)
    if (ip === '0.0.0.0') return true;
    // IPv6 checks
    if (ip === '::1') return true; // loopback
    if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true; // unique local
    if (/^fe80:/i.test(ip)) return true; // link-local
    return false;
};

const assertSafeUrl = async (rawUrl) => {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http/https URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Localhost URLs are not allowed');
    }

    // Resolve DNS ourselves and check the actual IP — checking the hostname
    // string alone isn't enough, since a public-looking hostname could
    // still resolve to a private IP (DNS rebinding).
    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true });
    } catch {
        throw new Error('Could not resolve host');
    }

    if (addresses.some((a) => isPrivateOrReservedIp(a.address))) {
        throw new Error('URL resolves to a private/internal address');
    }

    return parsed.toString();
};

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ]);

const resolveUrl = (base, maybeRelative) => {
    try {
        return new URL(maybeRelative, base).toString();
    } catch {
        return null;
    }
};

/**
 * GET /api/profile/link-preview?url=https://example.com
 * Public endpoint (no auth) since it's used on the public profile page.
 * Returns { title, description, image, siteName, url } — any field can
 * be null if not found, the frontend should handle that gracefully.
 */
router.get('/link-preview', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ message: 'url query param is required' });
        }

        const cached = cache.get(url);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        const safeUrl = await assertSafeUrl(url);

        const response = await withTimeout(
            fetch(safeUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DevCollabLinkPreview/1.0)' },
                redirect: 'follow',
            }),
            FETCH_TIMEOUT_MS
        );

        if (!response.ok) {
            throw new Error(`Fetch failed with status ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            throw new Error('URL did not return HTML');
        }

        // Read up to MAX_RESPONSE_BYTES rather than the full body — we only
        // need the <head>, and this caps memory/time on huge pages.
        const reader = response.body.getReader();
        let received = 0;
        let chunks = [];
        while (received < MAX_RESPONSE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
        }
        reader.cancel().catch(() => {});
        const html = Buffer.concat(chunks).toString('utf-8');

        const $ = cheerio.load(html);
        const getMeta = (prop) =>
            $(`meta[property="${prop}"]`).attr('content') ||
            $(`meta[name="${prop}"]`).attr('content') ||
            null;

        const title = getMeta('og:title') || $('title').first().text().trim() || null;
        const description = getMeta('og:description') || getMeta('description') || null;
        const siteName = getMeta('og:site_name') || null;
        let image = getMeta('og:image') || null;
        if (image) {
            image = resolveUrl(safeUrl, image); // og:image is sometimes a relative path
        }

        const data = {
            url: safeUrl,
            title,
            description,
            image,
            siteName,
        };

        cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return res.json(data);
    } catch (err) {
        // Failure here just means "no rich preview" — the frontend falls
        // back to a plain link, so this is a 200 with nulls rather than
        // a hard error the UI has to specifically handle.
        console.error('link-preview error:', err.message);
        return res.json({ url: req.query.url, title: null, description: null, image: null, siteName: null });
    }
});

module.exports = router;
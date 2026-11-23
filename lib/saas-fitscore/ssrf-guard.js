/**
 * SSRF Guard & URL Security Validator
 * Protects against Server-Side Request Forgery by blocking:
 * - Non-HTTP/HTTPS protocols
 * - Localhost / Loopback addresses (127.0.0.0/8, ::1)
 * - RFC 1918 Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Cloud Metadata IP endpoints (169.254.169.254, 169.254.0.0/16)
 * - Carrier-grade NAT, Multicast, Reserved, and IPv4-mapped IPv6 ranges
 */

const dns = require('dns').promises;
const { URL } = require('url');

// Helper to convert IPv4 string to 32-bit unsigned integer
function ipv4ToInt(ip) {
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Check if an IPv4 address falls within a CIDR range
function inCidr(ipInt, cidrIp, prefixLen) {
  const cidrInt = ipv4ToInt(cidrIp);
  if (cidrInt === null || ipInt === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (cidrInt & mask);
}

// Comprehensive check for forbidden / private / internal IPv4
function isForbiddenIPv4(ip) {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return true;

  // 127.0.0.0/8 (Loopback)
  if (inCidr(ipInt, '127.0.0.0', 8)) return true;
  // 0.0.0.0/8 ("This network")
  if (inCidr(ipInt, '0.0.0.0', 8)) return true;
  // 10.0.0.0/8 (Private-Use)
  if (inCidr(ipInt, '10.0.0.0', 8)) return true;
  // 172.16.0.0/12 (Private-Use)
  if (inCidr(ipInt, '172.16.0.0', 12)) return true;
  // 192.168.0.0/16 (Private-Use)
  if (inCidr(ipInt, '192.168.0.0', 16)) return true;
  // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
  if (inCidr(ipInt, '169.254.0.0', 16)) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (inCidr(ipInt, '100.64.0.0', 10)) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (inCidr(ipInt, '198.18.0.0', 15)) return true;
  // 224.0.0.0/4 (Multicast)
  if (inCidr(ipInt, '224.0.0.0', 4)) return true;
  // 240.0.0.0/4 (Reserved / Future Use)
  if (inCidr(ipInt, '240.0.0.0', 4)) return true;
  // 255.255.255.255 (Broadcast)
  if (ip === '255.255.255.255') return true;

  return false;
}

// Check for forbidden / private / internal IPv6
function isForbiddenIPv6(ip) {
  const normalized = ip.toLowerCase();
  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // Unspecified
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
  // Unique Local (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-Local (fe80::/10)
  if (/^fe[89ab]/i.test(normalized)) return true;
  // IPv4-mapped IPv6 (::ffff:192.0.2.128)
  if (normalized.includes('::ffff:')) {
    const parts = normalized.split('::ffff:');
    if (parts.length === 2) {
      return isForbiddenIPv4(parts[1]);
    }
  }
  return false;
}

/**
 * Validates a URL for SSRF vulnerabilities
 * @param {string} urlString - URL to validate
 * @returns {Promise<{ valid: boolean, reason?: string, parsedUrl?: URL }>}
 */
async function validateUrlForSSRF(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    return { valid: false, reason: 'Malformed URL: ' + err.message };
  }

  // 1. Enforce HTTP and HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Forbidden protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.` };
  }

  // 2. Reject credentials embedded in URL
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs containing embedded credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Fast string rejection for known bad hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254'
  ) {
    return { valid: false, reason: `Access to internal host '${hostname}' is strictly forbidden.` };
  }

  // 4. Resolve DNS and inspect every IP returned
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: `DNS lookup failed: No IP addresses resolved for '${hostname}'.` };
    }

    for (const record of addresses) {
      const { address, family } = record;
      if (family === 4 && isForbiddenIPv4(address)) {
        return { valid: false, reason: `Resolved IP '${address}' is in a private, loopback, or metadata range.` };
      }
      if (family === 6 && isForbiddenIPv6(address)) {
        return { valid: false, reason: `Resolved IPv6 '${address}' is in an internal or loopback range.` };
      }
    }
  } catch (dnsErr) {
    return { valid: false, reason: `DNS resolution failed for '${hostname}': ${dnsErr.message}` };
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Checks whether targetUrl belongs to the same domain or subdomain
 */
function isSameOrSubDomain(targetUrl, baseDomain) {
  try {
    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    const cleanBase = baseDomain.toLowerCase().replace(/^www\./, '');
    const cleanTarget = targetHost.replace(/^www\./, '');
    return cleanTarget === cleanBase || cleanTarget.endsWith('.' + cleanBase);
  } catch {
    return false;
  }
}

module.exports = {
  validateUrlForSSRF,
  isSameOrSubDomain,
  isForbiddenIPv4,
  isForbiddenIPv6
};

/**
 * SaaS FitScore — Firebase Cloud Firestore Database Layer
 * Supports:
 * 1. Google Cloud Firestore v1 REST API with Server-Side Service Account authentication
 * 2. Automated Google OAuth2 RS256 JWT access token minting (zero client credential leakage)
 * 3. Resilient development persistence fallback (data/firestore-local.json) when credentials not in .env
 * 
 * Collections managed:
 * - leads
 * - diagnostics
 * - crawls
 * - reports
 * - payments
 * - events
 * - admin_users
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOCAL_STORE_FILE = path.join(DATA_DIR, 'firestore-local.json');

// In-memory token cache for Google OAuth2
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Loads service account configuration from environment or file
 */
function getServiceAccount() {
  // Option A: Raw JSON in FIREBASE_SERVICE_ACCOUNT_KEY
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const val = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (val.startsWith('{')) {
        return JSON.parse(val);
      }
      // If it's a file path
      const filePath = path.resolve(val);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.warn('[Firestore] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // Option B: Individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  // Option C: Default credentials file in root if present
  const defaultPath = path.join(__dirname, '..', '..', 'firebase-service-account.json');
  if (fs.existsSync(defaultPath)) {
    try {
      return JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    } catch (e) {
      console.warn('[Firestore] Failed reading firebase-service-account.json:', e.message);
    }
  }

  return null;
}

/**
 * Mint Google OAuth2 access token using RS256 signed JWT
 */
async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 300) {
    return cachedToken;
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: now,
    exp: now + 3600
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${b64Header}.${b64Payload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for OAuth2 token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth2 token exchange failed HTTP ${tokenRes.status}: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = now + (tokenData.expires_in || 3600);
  return cachedToken;
}

/**
 * Helper to convert JavaScript value into Firestore REST API value format
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Helper to convert Firestore REST API value format back to standard JS object
 */
function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return val;
}

function parseFirestoreDocument(doc) {
  if (!doc || !doc.fields) return null;
  const data = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    data[k] = fromFirestoreValue(v);
  }
  if (doc.name) {
    data._id = doc.name.split('/').pop();
    data._firestorePath = doc.name;
  }
  return data;
}

// ══════════════════════════════════════════════════════
// LOCAL FILE PERSISTENCE FALLBACK
// ══════════════════════════════════════════════════════

function getLocalStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORE_FILE)) {
    const initial = {
      leads: [],
      diagnostics: [],
      crawls: [],
      reports: [],
      payments: [],
      events: [],
      admin_users: []
    };
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, 'utf8'));
  } catch {
    return { leads: [], diagnostics: [], crawls: [], reports: [], payments: [], events: [], admin_users: [] };
  }
}

function saveLocalStore(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════════════════════
// UNIFIED DATA ACCESS METHODS
// ══════════════════════════════════════════════════════

/**
 * Insert or update a document in a collection
 */
async function saveDocument(collection, id, docData) {
  const serviceAccount = getServiceAccount();
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    try {
      let headers = { 'Content-Type': 'application/json' };
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`;

      if (serviceAccount && serviceAccount.client_email) {
        const token = await getGoogleAccessToken(serviceAccount);
        headers['Authorization'] = `Bearer ${token}`;
      } else if (apiKey) {
        url += `?key=${apiKey}`;
      }

      const fields = {};
      for (const [k, v] of Object.entries(docData)) {
        fields[k] = toFirestoreValue(v);
      }

      const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firestore saveDocument error HTTP ${res.status}: ${errText}`);
      }

      const resJson = await res.json();
      return parseFirestoreDocument(resJson);
    } catch (firestoreErr) {
      console.warn(`[Firestore Error] Cloud write failed for ${collection}/${id}: ${firestoreErr.message}. Writing to local store.`);
    }
  }

  // Local Store Fallback
  const store = getLocalStore();
  if (!store[collection]) store[collection] = [];

  const idx = store[collection].findIndex(item => item.id === id || item._id === id);
  const record = { ...docData, id, updated_at: new Date().toISOString() };
  if (idx > -1) {
    store[collection][idx] = { ...store[collection][idx], ...record };
  } else {
    record.created_at = record.created_at || new Date().toISOString();
    store[collection].push(record);
  }
  saveLocalStore(store);
  return record;
}

/**
 * Retrieve a document by ID from a collection
 */
async function getDocument(collection, id) {
  const serviceAccount = getServiceAccount();
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    try {
      let headers = {};
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`;

      if (serviceAccount && serviceAccount.client_email) {
        const token = await getGoogleAccessToken(serviceAccount);
        headers['Authorization'] = `Bearer ${token}`;
      } else if (apiKey) {
        url += `?key=${apiKey}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firestore getDocument error HTTP ${res.status}: ${errText}`);
      }

      const resJson = await res.json();
      return parseFirestoreDocument(resJson);
    } catch (firestoreErr) {
      console.warn(`[Firestore Error] Cloud read failed for ${collection}/${id}: ${firestoreErr.message}. Reading from local store.`);
    }
  }

  // Local Store Fallback
  const store = getLocalStore();
  return (store[collection] || []).find(item => item.id === id || item._id === id) || null;
}

/**
 * List all documents in a collection
 */
async function listDocuments(collection) {
  const serviceAccount = getServiceAccount();
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = serviceAccount?.project_id || process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    try {
      let headers = {};
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`;

      if (serviceAccount && serviceAccount.client_email) {
        const token = await getGoogleAccessToken(serviceAccount);
        headers['Authorization'] = `Bearer ${token}`;
      } else if (apiKey) {
        url += `?key=${apiKey}`;
      }

      const res = await fetch(url, {
        headers
      });

      if (res.ok) {
        const resJson = await res.json();
        return (resJson.documents || []).map(parseFirestoreDocument);
      }
    } catch (err) {
      console.warn(`[Firestore Error] Cloud list failed for ${collection}: ${err.message}.`);
    }
  }

  const store = getLocalStore();
  return store[collection] || [];
}

// ══════════════════════════════════════════════════════
// COLLECTION CONVENIENCE API
// ══════════════════════════════════════════════════════

// Leads
async function createLead(leadData) {
  const leadId = leadData.id || `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    id: leadId,
    name: leadData.name || '',
    email: leadData.email || '',
    company: leadData.company || '',
    website: leadData.websiteUrl || leadData.website || '',
    consentRecord: {
      granted: leadData.consentGranted === true,
      timestamp: new Date().toISOString(),
      userAgent: leadData.userAgent || 'web'
    },
    created_at: new Date().toISOString()
  };
  return saveDocument('leads', leadId, record);
}

// Diagnostics
async function createDiagnostic(diagData) {
  const diagId = diagData.id || `diag_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    id: diagId,
    leadId: diagData.leadId,
    websiteUrl: diagData.websiteUrl,
    questionnaireAnswers: diagData.questionnaireAnswers || {},
    status: diagData.status || 'submitted', // submitted, crawling, analyzing, completed, failed
    stage: diagData.stage || 'registered',
    created_at: new Date().toISOString()
  };
  return saveDocument('diagnostics', diagId, record);
}

async function updateDiagnostic(diagId, updates) {
  const existing = (await getDocument('diagnostics', diagId)) || {};
  return saveDocument('diagnostics', diagId, { ...existing, ...updates });
}

// Crawls
async function createCrawlRecord(crawlData) {
  const crawlId = crawlData.id || `crawl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    id: crawlId,
    diagnosticId: crawlData.diagnosticId,
    targetUrl: crawlData.targetUrl,
    pagesCount: crawlData.pages ? crawlData.pages.length : 0,
    pages: crawlData.pages || [],
    crawlStatus: crawlData.crawlStatus || 'completed',
    errorDetails: crawlData.errorDetails || null,
    created_at: new Date().toISOString()
  };
  return saveDocument('crawls', crawlId, record);
}

// Reports
async function createReport(reportData) {
  const reportId = reportData.id || `rep_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const reportToken = reportData.reportToken || crypto.randomBytes(24).toString('hex');
  const record = {
    id: reportId,
    diagnosticId: reportData.diagnosticId,
    reportToken,
    overallScore: reportData.overallScore,
    overallRating: reportData.overallRating,
    dimensions: reportData.dimensions || {},
    evidenceCoverage: reportData.evidenceCoverage || {},
    topConstraints: reportData.topConstraints || [],
    findings: reportData.findings || [],
    recommendations: reportData.recommendations || {},
    generated_at: new Date().toISOString()
  };
  await saveDocument('reports', reportId, record);
  return record;
}

async function getReportByToken(token) {
  const reports = await listDocuments('reports');
  return reports.find(r => r.reportToken === token) || null;
}

// Payments
async function createPaymentRecord(paymentData) {
  const paymentId = paymentData.id || `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    id: paymentId,
    leadId: paymentData.leadId || '',
    product: paymentData.product || 'System to Make the Right Buyers Choose You',
    razorpayOrderId: paymentData.orderId || '',
    razorpayPaymentId: paymentData.paymentId || '',
    paymentStatus: paymentData.status || 'created',
    amount: paymentData.amount || 0,
    currency: paymentData.currency || 'INR',
    verificationStatus: paymentData.verified ? 'verified' : 'pending',
    created_at: new Date().toISOString()
  };
  return saveDocument('payments', paymentId, record);
}

async function updatePaymentRecord(paymentId, updates) {
  const existing = (await getDocument('payments', paymentId)) || {};
  return saveDocument('payments', paymentId, { ...existing, ...updates });
}

// Events
async function recordEvent(eventName, eventData = {}) {
  const eventId = `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const record = {
    id: eventId,
    name: eventName,
    data: eventData,
    timestamp: new Date().toISOString()
  };
  console.log(`[Event Tracked] ${eventName}:`, JSON.stringify(eventData));
  return saveDocument('events', eventId, record);
}

module.exports = {
  getServiceAccount,
  saveDocument,
  getDocument,
  listDocuments,
  createLead,
  createDiagnostic,
  updateDiagnostic,
  createCrawlRecord,
  createReport,
  getReportByToken,
  createPaymentRecord,
  updatePaymentRecord,
  recordEvent
};

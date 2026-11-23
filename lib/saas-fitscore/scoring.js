/**
 * SaaS FitScore — Deterministic Scoring Engine
 * Evaluates five connected commercial dimensions (20% weight each):
 * 1. Positioning (20%)
 * 2. Acquisition (20%)
 * 3. Activation (20%)
 * 4. Monetisation (20%)
 * 5. Retention (20%)
 * 
 * Rules:
 * - 100% deterministic (Gemini produces qualitative interpretations, NOT raw scores).
 * - Distinguishes between directly observed, founder-supplied, inferred, and unavailable evidence.
 * - Missing private metrics (e.g. churn rate, internal activation) are marked as unavailable and not penalized as failure.
 * - Overall score is weighted average: 0-39 (Significant gaps), 40-59 (Needs attention), 60-74 (Developing), 75-89 (Strong foundation), 90-100 (Highly aligned).
 */

const DIMENSION_WEIGHTS = {
  positioning: 0.20,
  acquisition: 0.20,
  activation: 0.20,
  monetisation: 0.20,
  retention: 0.20
};

// Interpretation Brackets
function getScoreInterpretation(score) {
  if (score < 40) return { rating: 'Significant Gaps', label: 'Significant gaps across commercial conversion funnels' };
  if (score < 60) return { rating: 'Needs Attention', label: 'Needs attention in key buyer decision points' };
  if (score < 75) return { rating: 'Developing', label: 'Developing commercial engine with identifiable bottlenecks' };
  if (score < 90) return { rating: 'Strong Foundation', label: 'Strong foundation ready for systematic scaling' };
  return { rating: 'Highly Aligned', label: 'Highly aligned growth engine across all dimensions' };
}

/**
 * Evaluates crawled content for specific keywords and structural signals
 */
function analyzeCrawlSignals(crawledPages = []) {
  const allText = crawledPages.map(p => (p.extractedContent || '') + ' ' + (p.pageTitle || '')).join(' ').toLowerCase();
  const allUrls = crawledPages.map(p => (p.url || '').toLowerCase());

  return {
    hasPricingPage: allUrls.some(u => u.includes('pricing') || u.includes('plans')),
    hasFeaturesPage: allUrls.some(u => u.includes('feature') || u.includes('product') || u.includes('platform')),
    hasSolutionsPage: allUrls.some(u => u.includes('solution') || u.includes('use-case')),
    hasIntegrationsPage: allUrls.some(u => u.includes('integration') || u.includes('apps') || u.includes('ecosystem')),
    hasDocsPage: allUrls.some(u => u.includes('doc') || u.includes('guide') || u.includes('help') || u.includes('faq')),
    hasCaseStudies: allUrls.some(u => u.includes('case-stud') || u.includes('customer') || u.includes('story')),

    // Textual signals
    mentionsOutcome: /\b(save|increase|reduce|revenue|roi|hours|automate|scale|grow|10x|faster|double)\b/i.test(allText),
    mentionsProof: /\b(customer|customers|trusted by|reviews|case study|results|testimonial|g2|capterra)\b/i.test(allText),
    mentionsTrialOrDemo: /\b(free trial|try free|get started|book demo|start free|free plan|no credit card)\b/i.test(allText),
    mentionsTiers: /\b(starter|pro|growth|enterprise|business|unlimited|per user|per seat|\/month|\/year)\b/i.test(allText),
    mentionsSecurityOrTrust: /\b(soc2|gdpr|hipaa|iso|encryption|secure|privacy|compliance)\b/i.test(allText),
    pageCount: crawledPages.length
  };
}

/**
 * Score Dimension 1: Positioning (Weight: 20%)
 */
function scorePositioning(founderAnswers, signals) {
  let score = 50; // baseline
  let evidencePoints = 0;
  const totalPoints = 5;

  // 1. Ideal Customer Clarity (Founder provided & descriptive)
  const icp = founderAnswers.idealCustomer || '';
  if (icp.length > 25) {
    score += 12;
    evidencePoints++;
  } else if (icp.length > 10) {
    score += 6;
    evidencePoints++;
  }

  // 2. Product Description Specificity
  const desc = founderAnswers.productDescription || '';
  if (desc.length > 35) {
    score += 10;
    evidencePoints++;
  }

  // 3. Outcome-Oriented Messaging observed on public pages
  if (signals.mentionsOutcome) {
    score += 12;
    evidencePoints++;
  }

  // 4. Solutions / Use-Case Structure present
  if (signals.hasSolutionsPage) {
    score += 10;
    evidencePoints++;
  }

  // 5. Differentiation from competitors
  const competitors = founderAnswers.competitors || '';
  const challenges = founderAnswers.challenges || [];
  if (competitors.length > 3) {
    score += 6;
    evidencePoints++;
  }
  if (challenges.includes('Differentiating from competitors')) {
    score -= 8; // founder explicitly identifies positioning differentiation bottleneck
  }

  return {
    score: Math.max(20, Math.min(100, Math.round(score))),
    evidenceCoverage: Math.round((evidencePoints / totalPoints) * 100),
    confidence: signals.pageCount >= 3 ? 'High' : 'Medium'
  };
}

/**
 * Score Dimension 2: Acquisition (Weight: 20%)
 */
function scoreAcquisition(founderAnswers, signals) {
  let score = 50;
  let evidencePoints = 0;
  const totalPoints = 5;

  // 1. Signup / Demo CTA clarity
  if (signals.mentionsTrialOrDemo) {
    score += 12;
    evidencePoints++;
  }

  // 2. Proof & Trust Signals (Customer logos, ratings, case studies)
  if (signals.mentionsProof || signals.hasCaseStudies) {
    score += 12;
    evidencePoints++;
  }

  // 3. Pricing transparency on public site
  if (signals.hasPricingPage) {
    score += 12;
    evidencePoints++;
  }

  // 4. Monthly signups volume (founder reported)
  const signups = founderAnswers.monthlySignups || '';
  if (signups === '2,000–10,000' || signups === 'More than 10,000') {
    score += 14;
    evidencePoints++;
  } else if (signups === '500–2,000') {
    score += 8;
    evidencePoints++;
  } else if (signups === '100–500') {
    score += 4;
    evidencePoints++;
  }

  // 5. Acquisition Drop-Off penalty
  const dropOff = founderAnswers.dropOff || '';
  if (dropOff === 'Visitors do not sign up') {
    score -= 12;
  }

  return {
    score: Math.max(20, Math.min(100, Math.round(score))),
    evidenceCoverage: Math.round((evidencePoints / totalPoints) * 100),
    confidence: 'High'
  };
}

/**
 * Score Dimension 3: Activation (Weight: 20%)
 */
function scoreActivation(founderAnswers, signals) {
  let score = 55;
  let evidencePoints = 0;
  const totalPoints = 4;

  // 1. Documentation or Guided Help observed
  if (signals.hasDocsPage) {
    score += 14;
    evidencePoints++;
  }

  // 2. Feature / Walkthrough Page present
  if (signals.hasFeaturesPage) {
    score += 10;
    evidencePoints++;
  }

  // 3. Business Model vs Onboarding Fit
  const bModel = founderAnswers.businessModel || '';
  if (bModel === 'Freemium' || bModel === 'Free trial') {
    // Self-serve products require high initial onboarding clarity
    evidencePoints++;
  } else if (bModel === 'Demo-led') {
    score += 6; // Guided activation handled via sales reps
    evidencePoints++;
  }

  // 4. Founder drop-off penalty
  const dropOff = founderAnswers.dropOff || '';
  const challenges = founderAnswers.challenges || [];
  if (dropOff === 'Users sign up but do not use the product') {
    score -= 18;
    evidencePoints++;
  }
  if (challenges.includes('Getting users to activate')) {
    score -= 8;
  }

  return {
    score: Math.max(20, Math.min(100, Math.round(score))),
    evidenceCoverage: Math.round((evidencePoints / totalPoints) * 100),
    confidence: 'Medium' // Private in-app activation rates are unobserved externally
  };
}

/**
 * Score Dimension 4: Monetisation (Weight: 20%)
 */
function scoreMonetisation(founderAnswers, signals) {
  let score = 50;
  let evidencePoints = 0;
  const totalPoints = 5;

  // 1. Pricing Page with Tier Differentiation
  if (signals.hasPricingPage) {
    score += 14;
    evidencePoints++;
  }
  if (signals.mentionsTiers) {
    score += 10;
    evidencePoints++;
  }

  // 2. Free-to-paid conversion reported by founder
  const conversion = founderAnswers.freeToPaidConversion || '';
  if (conversion === 'Above 10%') {
    score += 16;
    evidencePoints++;
  } else if (conversion === '5–10%') {
    score += 12;
    evidencePoints++;
  } else if (conversion === '3–5%') {
    score += 6;
    evidencePoints++;
  } else if (conversion === 'Below 1%') {
    score -= 10;
    evidencePoints++;
  }

  // 3. MRR validation
  const mrr = founderAnswers.approxMrr || '';
  if (mrr === '$25,000–$50,000' || mrr === 'Above $50,000') {
    score += 12;
    evidencePoints++;
  } else if (mrr === '$10,000–$25,000') {
    score += 8;
    evidencePoints++;
  }

  // 4. Drop-off penalty
  const dropOff = founderAnswers.dropOff || '';
  if (dropOff === 'Users activate but do not pay' || dropOff === 'Customers pay but do not upgrade') {
    score -= 14;
  }

  return {
    score: Math.max(20, Math.min(100, Math.round(score))),
    evidenceCoverage: Math.round((evidencePoints / totalPoints) * 100),
    confidence: 'High'
  };
}

/**
 * Score Dimension 5: Retention (Weight: 20%)
 */
function scoreRetention(founderAnswers, signals) {
  let score = 55;
  let evidencePoints = 0;
  const totalPoints = 4;

  // 1. Ecosystem / Integrations page
  if (signals.hasIntegrationsPage) {
    score += 16;
    evidencePoints++;
  }

  // 2. Security & Compliance Proof (Essential for B2B Enterprise Retention)
  if (signals.mentionsSecurityOrTrust) {
    score += 10;
    evidencePoints++;
  }

  // 3. Customer Education & Documentation
  if (signals.hasDocsPage) {
    score += 10;
    evidencePoints++;
  }

  // 4. Churn Drop-off penalty
  const dropOff = founderAnswers.dropOff || '';
  const challenges = founderAnswers.challenges || [];
  if (dropOff === 'Customers churn after a short period') {
    score -= 20;
    evidencePoints++;
  }
  if (challenges.includes('Retaining customers')) {
    score -= 10;
  }

  return {
    score: Math.max(20, Math.min(100, Math.round(score))),
    evidenceCoverage: Math.round((evidencePoints / totalPoints) * 100),
    confidence: 'Medium' // Exact churn percentages are private
  };
}

/**
 * Main Deterministic Scoring Calculator
 */
function calculateFitScore(founderAnswers = {}, crawledPages = []) {
  const signals = analyzeCrawlSignals(crawledPages);

  const dimScores = {
    positioning: scorePositioning(founderAnswers, signals),
    acquisition: scoreAcquisition(founderAnswers, signals),
    activation: scoreActivation(founderAnswers, signals),
    monetisation: scoreMonetisation(founderAnswers, signals),
    retention: scoreRetention(founderAnswers, signals)
  };

  // Weighted Average Calculation
  const overallScore = Math.round(
    dimScores.positioning.score * DIMENSION_WEIGHTS.positioning +
    dimScores.acquisition.score * DIMENSION_WEIGHTS.acquisition +
    dimScores.activation.score * DIMENSION_WEIGHTS.activation +
    dimScores.monetisation.score * DIMENSION_WEIGHTS.monetisation +
    dimScores.retention.score * DIMENSION_WEIGHTS.retention
  );

  const avgEvidenceCoverage = Math.round(
    (dimScores.positioning.evidenceCoverage +
     dimScores.acquisition.evidenceCoverage +
     dimScores.activation.evidenceCoverage +
     dimScores.monetisation.evidenceCoverage +
     dimScores.retention.evidenceCoverage) / 5
  );

  const interpretation = getScoreInterpretation(overallScore);

  return {
    overallScore,
    overallRating: interpretation.rating,
    interpretationLabel: interpretation.label,
    evidenceCoverage: avgEvidenceCoverage,
    signalsSummary: signals,
    dimensions: {
      positioning: {
        score: dimScores.positioning.score,
        weight: '20%',
        coverage: dimScores.positioning.evidenceCoverage,
        confidence: dimScores.positioning.confidence
      },
      acquisition: {
        score: dimScores.acquisition.score,
        weight: '20%',
        coverage: dimScores.acquisition.evidenceCoverage,
        confidence: dimScores.acquisition.confidence
      },
      activation: {
        score: dimScores.activation.score,
        weight: '20%',
        coverage: dimScores.activation.evidenceCoverage,
        confidence: dimScores.activation.confidence
      },
      monetisation: {
        score: dimScores.monetisation.score,
        weight: '20%',
        coverage: dimScores.monetisation.evidenceCoverage,
        confidence: dimScores.monetisation.confidence
      },
      retention: {
        score: dimScores.retention.score,
        weight: '20%',
        coverage: dimScores.retention.evidenceCoverage,
        confidence: dimScores.retention.confidence
      }
    }
  };
}

module.exports = {
  calculateFitScore,
  getScoreInterpretation,
  DIMENSION_WEIGHTS
};

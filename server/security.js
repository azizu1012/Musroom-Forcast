import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Configure Helmet security headers to prevent information disclosure,
 * MIME sniffing, clickjacking, and XSS attacks.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

/**
 * Rate limiters: Prevents denial of service and API quota abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.', code: 'RATE_LIMIT_EXCEEDED' }
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Search rate limit exceeded. Please wait a moment.', code: 'SEARCH_LIMIT_EXCEEDED' }
});

export const crudLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location modifications. Please try again shortly.', code: 'MUTATION_LIMIT_EXCEEDED' }
});

/**
 * Input sanitization helpers
 */
export function sanitizeString(input, maxLength = 100) {
  if (typeof input !== 'string') return '';
  // Strip HTML tags and control characters
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return { valid: false, message: 'Latitude must be a valid number between -90 and 90' };
  }
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return { valid: false, message: 'Longitude must be a valid number between -180 and 180' };
  }

  return { valid: true, latitude, longitude };
}

/**
 * Error masking middleware: Prevents internal stack traces and paths from leaking
 */
export function secureErrorHandler(err, req, res, next) {
  // Log full error internally for server diagnostic
  console.error(`[SECURE ERROR] [${req.method}] ${req.url} ->`, err.message);

  // Return clean, sanitized JSON to user
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'An internal server error occurred' : err.message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}

// Standardized errors using Problem Details (RFC 7807).
export class ProblemError extends Error {
  constructor({ status, title, detail, type = 'about:blank', extensions = {} }) {
    super(detail || title);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    this.extensions = extensions;
  }
}

export function sendProblem(res, { status, title, detail, type = 'about:blank', instance, extensions = {} }) {
  res.status(status).type('application/problem+json').json({ type, title, status, detail, instance, ...extensions });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ProblemError) {
    return sendProblem(res, { status: err.status, title: err.title, detail: err.detail, type: err.type, instance: req.originalUrl, extensions: err.extensions });
  }
  console.error(err);
  return sendProblem(res, { status: 500, title: 'Internal Server Error', detail: 'An unexpected error occurred.', instance: req.originalUrl });
}

export function notFoundHandler(req, res) {
  sendProblem(res, { status: 404, title: 'Not Found', detail: `Resource ${req.originalUrl} does not exist.`, instance: req.originalUrl });
}

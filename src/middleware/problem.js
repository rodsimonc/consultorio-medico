// Bloque JSON + Bloque APIRest: errores estandarizados con Problem Details (RFC 7807).
// Todas las respuestas de error de la API usan este formato y el content-type
// application/problem+json.

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
  res
    .status(status)
    .type('application/problem+json')
    .json({
      type,
      title,
      status,
      detail,
      instance,
      ...extensions,
    });
}

// Middleware final de manejo de errores.
export function errorHandler(err, req, res, _next) {
  if (err instanceof ProblemError) {
    return sendProblem(res, {
      status: err.status,
      title: err.title,
      detail: err.detail,
      type: err.type,
      instance: req.originalUrl,
      extensions: err.extensions,
    });
  }

  // Fallback: error no controlado.
  console.error(err);
  return sendProblem(res, {
    status: 500,
    title: 'Internal Server Error',
    detail: 'Ocurrió un error inesperado en el servidor.',
    instance: req.originalUrl,
  });
}

// Handler para rutas no encontradas.
export function notFoundHandler(req, res) {
  sendProblem(res, {
    status: 404,
    title: 'Not Found',
    detail: `El recurso ${req.originalUrl} no existe.`,
    instance: req.originalUrl,
  });
}

import type { FastifyInstance } from 'fastify';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: ErrorWithStatusCode, _request, reply) => {
    app.log.error(error);

    reply.status(error.statusCode ?? 500).send({
      error: error.message || 'Unexpected server error.',
    });
  });
}

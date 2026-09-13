import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown keys rather than trusting them onto a Prisma write.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Transcripts are long; the default body limit would reject a full session.
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  /**
   * Optional pattern for origins that cannot be enumerated ahead of time.
   *
   * Every Vercel deployment gets its own hashed hostname — a preview build, or
   * the immutable URL of a production deploy — so an exact allowlist only ever
   * covers the stable production alias. Opening the browser on any other
   * deployment URL then fails the preflight, which presents as a bare
   * "NetworkError" in the UI and is easy to misread as the API being down.
   *
   * Left unset, behaviour is an exact allowlist and nothing else.
   */
  const originPatternSource = process.env.CORS_ORIGIN_REGEX?.trim();
  let originPattern: RegExp | null = null;

  if (originPatternSource) {
    try {
      originPattern = new RegExp(originPatternSource);
    } catch {
      // A malformed pattern must not silently widen or narrow access; fail loudly.
      throw new Error(`CORS_ORIGIN_REGEX is not a valid regular expression: ${originPatternSource}`);
    }
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Same-origin and non-browser callers (curl, health checks, server-to-
      // server) send no Origin header and are not subject to CORS at all.
      if (!origin) return callback(null, true);

      const allowed = allowedOrigins.includes(origin) || (originPattern?.test(origin) ?? false);
      // Refusing by omitting the header, rather than throwing: a throw would
      // surface as a 500 and read like a server fault instead of a policy answer.
      callback(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  Logger.log(
    `Allswell API listening on :${port} (CORS: ${allowedOrigins.join(', ') || 'none'}` +
      `${originPattern ? ` + /${originPattern.source}/` : ''})`,
    'Bootstrap',
  );
}

void bootstrap();

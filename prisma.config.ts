import 'dotenv/config'; // * loads .env file for database connection

import path from 'node:path';
import type { PrismaConfig } from 'prisma';

export default {
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  views: {
    path: path.join('prisma', 'views'),
  },
  typedSql: {
    path: path.join('prisma', 'queries'),
  },
  experimental: {
    studio: true,
    adapter: true,
    externalTables: true,
  },
} satisfies PrismaConfig;

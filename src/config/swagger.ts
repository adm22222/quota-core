import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const openApiPath = resolve(process.cwd(), 'docs/openapi.yaml');

const openApiDocument = parse(readFileSync(openApiPath, 'utf8'));

export { openApiDocument, swaggerUi };

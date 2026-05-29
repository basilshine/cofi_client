import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const rootDir = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const schemaPath = path.resolve(rootDir, "../cofi_infra/shared/openapi.yaml");
const outputPath = path.resolve(rootDir, "src/types/api-types.ts");
const ast = await openapiTS(await readFile(schemaPath));

await writeFile(outputPath, `${COMMENT_HEADER}${astToString(ast)}`, "utf8");
console.log(`Generated ${path.relative(rootDir, outputPath)}`);

import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

import { runYarn } from "../src/test/run-yarn.ts";

// The standalone server, as the production image runs it, does not copy
// public/ or the built static files itself. Node's copy works on Windows;
// the `cp` this replaced does not.

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

runYarn(["prisma", "migrate", "deploy"]);
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
mkdirSync(path.join(standalone, ".next"), { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });

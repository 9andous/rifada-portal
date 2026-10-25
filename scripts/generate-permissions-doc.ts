import { writeFileSync } from "node:fs";
import { renderPermissionsDoc } from "../src/server/authz/permissions-doc";

writeFileSync(new URL("../docs/PERMISSIONS.md", import.meta.url), renderPermissionsDoc());
console.log("docs/PERMISSIONS.md updated");

// Prints a new Ed25519 key for the electronic seals (D-122), as the line to put in .env:
//   npm run seal:keygen
// Keep it secret and back it up: seals made with a key verify only while that key is configured.
// Changing the key makes every existing document fail verification.

import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ed25519");
const der = privateKey.export({ format: "der", type: "pkcs8" });
console.log(`SEAL_PRIVATE_KEY="${der.toString("base64")}"`);

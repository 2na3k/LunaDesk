import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../public/lunadesk.svg", import.meta.url));
const output = fileURLToPath(new URL("../electron/assets/", import.meta.url));
await mkdir(output, { recursive: true });
await sharp(source).resize(1024, 1024).png().toFile(`${output}/icon.png`);
console.log("Exported electron/assets/icon.png from public/lunadesk.svg");

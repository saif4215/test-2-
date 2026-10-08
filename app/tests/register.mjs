// Lets plain Node load the app's modules, which import each other without file extensions (the bundler allows that).
import { register } from "node:module";
register("./resolve-hook.mjs", import.meta.url);

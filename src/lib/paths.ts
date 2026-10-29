import path from "path";

export function storageRoot() {
  const configured = process.env.STORAGE_DIR || "./storage";
  if (path.isAbsolute(configured)) return configured;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
}

export function uploadsDir() {
  return path.join(storageRoot(), "uploads");
}

export function pdfsDir() {
  return path.join(storageRoot(), "pdfs");
}

export function fontsDir() {
  return path.join(process.cwd(), "assets", "fonts");
}

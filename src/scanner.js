import { readDir } from "@tauri-apps/plugin-fs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const DAW_EXTENSIONS = [".flp", ".als", ".ptx", ".ptf", ".rpp"];
const SKIP_FOLDERS = ["backup","backups","samples","samples imported","recorded","exports","bounced files","audio files","video files","ableton project info","cache",".git","node_modules","reaper_peak_cache","reaper-cache"];

function getDaw(ext) {
  switch (ext) {
    case ".flp":    return "fl";
    case ".als":    return "ab";
    case ".ptx":
    case ".ptf":    return "pt";
    case ".rpp":    return "rp";
    default:        return null;
  }
}

async function scanDirectory(dirPath, foundFiles = []) {
  try {
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      const nameLower = (entry.name || "").toLowerCase();
      if (entry.isDirectory || entry.children !== undefined) {
        if (SKIP_FOLDERS.includes(nameLower)) continue;
        await scanDirectory(dirPath + "\\" + entry.name, foundFiles);
      } else {
        const dot = nameLower.lastIndexOf(".");
        if (dot === -1) continue;
        const ext = nameLower.substring(dot);
        if (!DAW_EXTENSIONS.includes(ext)) continue;
        if (ext === ".als" && entry.name.includes("[")) continue;
        if (ext === ".flp" && nameLower.includes("autosave")) continue;
        if (ext === ".rpp" && (nameLower.endsWith(".rpp.bak") || nameLower.includes("-autosave"))) continue;
        if (nameLower.startsWith("~") || nameLower.startsWith(".")) continue;
        const fullPath = dirPath + "\\" + entry.name;
        foundFiles.push({ id: fullPath, title: entry.name.substring(0, entry.name.lastIndexOf(".")), daw: getDaw(ext), path: fullPath, tags: [], note: "", date: "Just found" });
      }
    }
  } catch (e) { console.warn("Skipped:", dirPath); }
  return foundFiles;
}

export async function pickAndScanFolder() {
  const selected = await openDialog({ directory: true, multiple: true, title: "Select folders to scan for DAW projects" });
  if (!selected || selected.length === 0) return null;
  const folders = Array.isArray(selected) ? selected : [selected];
  let allFiles = [];
  for (const folder of folders) { const found = await scanDirectory(folder); allFiles = [...allFiles, ...found]; }
  return { files: allFiles, folders };
}

export async function scanForProjects(customFolders) {
  if (!customFolders || customFolders.length === 0) return [];
  let allFiles = [];
  for (const folder of customFolders) { const found = await scanDirectory(folder); allFiles = [...allFiles, ...found]; }
  return allFiles;
}

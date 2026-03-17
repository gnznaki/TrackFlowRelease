import { PRODUCER_COLUMNS, ENGINEER_COLUMNS, DEFAULT_TAGS, DEFAULT_COL_HEIGHT } from "./constants";
import { BASE_PRESETS } from "./theme";

export function migrateState(saved) {
  if (!saved) return null;
  const themeMap = { dark: "default", slate: "tabkiller", warm: "daves", cyber: "findanote" };
  let themePreset = saved.themePreset || (themeMap[saved.themeKey] || "default");
  const pCols = saved.producerCols || PRODUCER_COLUMNS;
  const eCols = saved.engineerCols || ENGINEER_COLUMNS;
  return {
    mode: saved.mode || "producer",
    producerCols: pCols,
    engineerCols: eCols,
    producerLayout: saved.producerLayout || [pCols.map(c => c.id)],
    engineerLayout: saved.engineerLayout || [eCols.map(c => c.id)],
    projects: saved.projects || [],
    watchedFolders: saved.watchedFolders || [],
    customTags: saved.customTags || DEFAULT_TAGS,
    themePreset,
    themeCustom: saved.themeCustom || BASE_PRESETS[themePreset] || BASE_PRESETS.default,
    font: saved.font || "Syne",
    colMaxHeight: saved.colMaxHeight || DEFAULT_COL_HEIGHT,
    discordWebhook: saved.discordWebhook || "",
    collapsedCols: saved.collapsedCols || [],
    lockedCols: saved.lockedCols || [],
  };
}

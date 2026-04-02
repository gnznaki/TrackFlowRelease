import { PRODUCER_COLUMNS, ENGINEER_COLUMNS, DEFAULT_TAGS, DEFAULT_COL_HEIGHT } from "./constants";
import { BASE_PRESETS } from "./theme";

export function migrateState(saved) {
  if (!saved) return null;
  const themeMap = { dark: "default", slate: "tabkiller", warm: "daves", cyber: "findanote" };
  let themePreset = saved.themePreset || (themeMap[saved.themeKey] || "default");

  let pages, currentPageId;

  if (saved.pages) {
    // New format — already has pages array; back-fill color if missing
    const defaultColors = ["#c8ff47", "#47c8ff", "#b847ff", "#ff6b47", "#3af0b0", "#ff4780"];
    pages = saved.pages.map((p, i) => p.color ? p : { ...p, color: defaultColors[i % defaultColors.length] });
    currentPageId = saved.currentPageId || saved.pages[0]?.id;
  } else {
    // Old dual-board format — convert to pages
    const pCols = saved.producerCols || PRODUCER_COLUMNS;
    const eCols = saved.engineerCols || ENGINEER_COLUMNS;
    pages = [
      {
        id: "producer",
        name: saved.pageNames?.producer || "Producer",
        color: "#c8ff47",
        boardId: saved.producerBoardId || crypto.randomUUID(),
        columns: pCols,
        layout: saved.producerLayout || [pCols.map(c => c.id)],
      },
      {
        id: "engineer",
        name: saved.pageNames?.engineer || "Engineer",
        color: "#47c8ff",
        boardId: saved.engineerBoardId || crypto.randomUUID(),
        columns: eCols,
        layout: saved.engineerLayout || [eCols.map(c => c.id)],
      },
    ];
    currentPageId = saved.mode === "engineer" ? "engineer" : "producer";
  }

  return {
    pages,
    currentPageId,
    projects: saved.projects || [],
    watchedFolders: saved.watchedFolders || [],
    customTags: saved.customTags || DEFAULT_TAGS,
    themePreset,
    themeCustom: saved.themeCustom || BASE_PRESETS[themePreset] || BASE_PRESETS.default,
    font: saved.font || "Syne",
    colMaxHeight: saved.colMaxHeight || DEFAULT_COL_HEIGHT,
    collapsedCols: saved.collapsedCols || [],
    lockedCols: saved.lockedCols || [],
    sharedBoards: saved.sharedBoards || [],
  };
}

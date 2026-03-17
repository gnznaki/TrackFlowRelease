import { saveState, loadState, backupState } from "./storage";
import { useState, useEffect, useRef, useCallback } from "react";
import { scanForProjects, pickAndScanFolder } from "./scanner";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable, rectIntersection, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { invoke } from "@tauri-apps/api/core";
import { buildTheme, BASE_PRESETS, FONT_WEIGHTS } from "./lib/theme";
import { PRODUCER_COLUMNS, ENGINEER_COLUMNS, DEFAULT_TAGS, DEFAULT_COL_HEIGHT } from "./lib/constants";
import { migrateState } from "./lib/migrate";
import { setWebhookUrl, postToDiscord } from "./lib/discord";
import { SortableColumn, CardContent } from "./components/Column";
import ProjectSidebar from "./components/ProjectSidebar";
import DetailPanel from "./components/DetailPanel";
import ThemeCustomizer from "./components/ThemeCustomizer";
import SettingsPanel from "./components/SettingsPanel";
import TagManager from "./components/TagManager";
import SortFilterDropdown from "./components/SortFilterDropdown";
import { Icon, Icons } from "./components/Icon";
import { AuthScreenInner } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";
import "./App.css";

function App() {
  const { user, loading: authLoading, isOffline, initial, signIn, signUp, signOut, goOffline } = useAuth();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("producer");
  const [producerCols, setProducerCols] = useState(PRODUCER_COLUMNS);
  const [engineerCols, setEngineerCols] = useState(ENGINEER_COLUMNS);
  const [producerLayout, setProducerLayout] = useState([PRODUCER_COLUMNS.map(c => c.id)]);
  const [engineerLayout, setEngineerLayout] = useState([ENGINEER_COLUMNS.map(c => c.id)]);
  const [layoutView, setLayoutView] = useState("grid"); // "grid" (multi-row) | "panel" (single row)
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [watchedFolders, setWatchedFolders] = useState([]);
  const [customTags, setCustomTags] = useState(DEFAULT_TAGS);
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [activeColId, setActiveColId] = useState(null);
  const [isCardDrag, setIsCardDrag] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themePreset, setThemePreset] = useState("default");
  const [themeCustom, setThemeCustom] = useState(BASE_PRESETS.default);
  const [font, setFont] = useState("Syne");
  const [colMaxHeight, setColMaxHeight] = useState(DEFAULT_COL_HEIGHT);
  const [sortBy, setSortBy] = useState("modified");
  const [sortDir, setSortDir] = useState("desc");
  const [modeTransition, setModeTransition] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);
  const [collapsedCols, setCollapsedCols] = useState([]);
  const [lockedCols, setLockedCols] = useState([]);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorLog, setErrorLog] = useState([]);
  const [showErrorBar, setShowErrorBar] = useState(false);

  const theme = buildTheme(themeCustom.bg, themeCustom.cardBg, themeCustom.borderHex, themeCustom.accent, font);
  const columns = mode === "producer" ? producerCols : engineerCols;
  const setColumns = mode === "producer" ? setProducerCols : setEngineerCols;
  const layout = mode === "producer" ? producerLayout : engineerLayout;
  const setLayout = mode === "producer" ? setProducerLayout : setEngineerLayout;
  const isGridView = layoutView === "grid";

  // ALL HOOKS BEFORE EARLY RETURN
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const columnsRef = useRef(columns);
    useEffect(() => { columnsRef.current = columns; }, [columns]);
    const layoutRef = useRef(layout);
    useEffect(() => { layoutRef.current = layout; }, [layout]);
    const dragStartColRef = useRef(null);
  const lastColumnOverRef = useRef(null);
  const rafColumnReorderRef = useRef(null);
  const savedGridLayoutRef = useRef({ producer: null, engineer: null });

  function flattenLayout(lyt) {
    return (lyt || []).flat().map(String);
  }

  function normalizeLayout(lyt, colIds) {
    const ids = colIds.map(String);
    const seen = new Set();
    const outRows = (lyt || [])
      .map(row => (row || []).map(String).filter(id => ids.includes(id)))
      .filter(row => row.length > 0)
      .map(row => row.filter(id => (seen.has(id) ? false : (seen.add(id), true))));
    const missing = ids.filter(id => !seen.has(id));
    if (missing.length > 0) {
      if (outRows.length === 0) outRows.push([]);
      outRows[outRows.length - 1].push(...missing);
    }
    return outRows.length > 0 ? outRows : [ids];
  }

  function computeGridLayoutFromOrder(order) {
    // Roughly account for sidebars (235 + 275) + paddings/gaps
    const available = Math.max(500, window.innerWidth - 560);
    const colW = 285;
    const gap = 14;
    const perRow = Math.max(1, Math.min(6, Math.floor((available + gap) / (colW + gap))));
    const rows = [];
    for (let i = 0; i < order.length; i += perRow) rows.push(order.slice(i, i + perRow));
    return rows.slice(0, 4);
  }

  const applyResponsiveLayout = useCallback((nextView) => {
    const key = mode === "producer" ? "producer" : "engineer";
    const colIds = columnsRef.current.map(c => String(c.id));
    const current = normalizeLayout(layoutRef.current, colIds);

    if (nextView === "panel") {
      // Save current grid so we can restore it later.
      savedGridLayoutRef.current[key] = current;
      const order = flattenLayout(current);
      const panelLayout = [order];
      setLayout(panelLayout);
      layoutRef.current = panelLayout;
      return;
    }

    // nextView === "grid"
    const saved = savedGridLayoutRef.current[key];
    const restored = saved ? normalizeLayout(saved, colIds) : computeGridLayoutFromOrder(flattenLayout(current));
    setLayout(restored);
    layoutRef.current = restored;
  }, [mode, setLayout]);

  // Auto-switch between panel (single row) and grid (multi-row) based on window width.
  useEffect(() => {
    function decideView() {
      const next = window.innerWidth < 1200 ? "panel" : "grid";
      setLayoutView(prev => (prev === next ? prev : next));
    }
    decideView();
    window.addEventListener("resize", decideView);
    return () => window.removeEventListener("resize", decideView);
  }, []);

  // When layoutView changes, transform the underlying saved layout once (minimal + preserves DnD logic).
  useEffect(() => {
    if (!ready) return;
    applyResponsiveLayout(layoutView);
  }, [ready, layoutView, applyResponsiveLayout]);

  useEffect(() => {
    loadState().then(raw => {
      const saved = migrateState(raw);
      if (saved) {
        setMode(saved.mode); setProducerCols(saved.producerCols); setEngineerCols(saved.engineerCols);
        setProducerLayout(saved.producerLayout); setEngineerLayout(saved.engineerLayout);
        setProjects(saved.projects); setWatchedFolders(saved.watchedFolders); setCustomTags(saved.customTags);
        setThemePreset(saved.themePreset); setThemeCustom(saved.themeCustom); setFont(saved.font);
        setColMaxHeight(saved.colMaxHeight); setCollapsedCols(saved.collapsedCols); setLockedCols(saved.lockedCols);
        setDiscordWebhook(saved.discordWebhook); setWebhookUrl(saved.discordWebhook);
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    async function loadTimes(cols) {
      return Promise.all(cols.map(async col => ({ ...col, cards: await Promise.all(col.cards.map(async card => { if (!card.path || card.path.startsWith("~")) return card; try { return { ...card, fileModified: await invoke("get_file_modified", { path: card.path }) }; } catch (e) { return card; } })) })));
    }
    loadTimes(producerCols).then(setProducerCols);
    loadTimes(engineerCols).then(setEngineerCols);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    saveState({ mode, producerCols, engineerCols, producerLayout, engineerLayout, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, discordWebhook, collapsedCols, lockedCols });
  }, [ready, mode, producerCols, engineerCols, producerLayout, engineerLayout, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, discordWebhook, collapsedCols, lockedCols]);

  // Orphan cleanup — ref pattern avoids #105 loop
  const orphanRef = useRef(null);
  orphanRef.current = { producerCols, engineerCols };
  useEffect(() => {
    const allCardIds = new Set([...orphanRef.current.producerCols, ...orphanRef.current.engineerCols].flatMap(c => c.cards.map(x => x.id)));
    setProjects(ps => { const cleaned = ps.map(p => ({ ...p, songs: (p.songs || []).filter(id => allCardIds.has(id)) })); return cleaned.some((p, i) => p.songs.length !== ps[i].songs.length) ? cleaned : ps; });
  }, [producerCols, engineerCols]);

  // Global error catch
  useEffect(() => {
    const onErr = e => { setErrorLog(prev => [...prev, { message: e.message, stack: e.error?.stack, time: Date.now() }]); setShowErrorBar(true); };
    const onRej = e => { setErrorLog(prev => [...prev, { message: String(e.reason), stack: e.reason?.stack, time: Date.now() }]); setShowErrorBar(true); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);

  // Dynamic font loading
  useEffect(() => {
    const name = font.replace(/ /g, "+");
    const w = FONT_WEIGHTS[font] || "400;700";
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = `https://fonts.googleapis.com/css2?family=${name}:wght@${w}&display=swap`;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch (e) {} };
  }, [font]);

  // Still resolving auth session — show a minimal splash
  if (authLoading) return (
    <div style={{ height: "100vh", background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Track<span style={{ color: "#c8ff47" }}>Flow</span></div>
    </div>
  );

  // Not signed in and not in offline mode — show auth screen
  if (!user && !isOffline) return (
    <AuthScreenInner signIn={signIn} signUp={signUp} onOffline={goOffline} />
  );

  // State is loading from disk
  if (!ready) return (
    <div style={{ height: "100vh", background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Track<span style={{ color: "#c8ff47" }}>Flow</span></div>
      <div style={{ fontSize: 12, color: "#555" }}>Loading your projects...</div>
    </div>
  );

  // ── LAYOUT HELPERS ────────────────────────────────────────────────────────────
  function getColRowIdx(colId, lyt = layout) { return lyt.findIndex(row => row.includes(String(colId))); }

  function moveColToRow(colId, targetRowIdx) {
    let newLayout = layout.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
    const clampedIdx = Math.max(0, Math.min(targetRowIdx, newLayout.length));
    if (clampedIdx < newLayout.length) { newLayout[clampedIdx] = [...newLayout[clampedIdx], String(colId)]; }
    else if (newLayout.length < 4) { newLayout.push([String(colId)]); }
    setLayout(newLayout);
  }

  function handleMoveRowUp(colId) {
    setLayout(current => {
      const rowIdx = current.findIndex(row => row.includes(String(colId)));
      if (rowIdx <= 0) return current;
      const newLayout = current.map(row => row.filter(id => id !== String(colId)));
      newLayout[rowIdx - 1] = [...newLayout[rowIdx - 1], String(colId)];
      return newLayout.filter(row => row.length > 0);
    });
  }

  function handleMoveRowDown(colId) {
    setLayout(current => {
      const rowIdx = current.findIndex(row => row.includes(String(colId)));
      if (rowIdx === -1) return current;
      let newLayout = current.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
      if (rowIdx < newLayout.length) {
        newLayout[rowIdx] = [...newLayout[rowIdx], String(colId)];
      } else if (newLayout.length < 4) {
        newLayout.push([String(colId)]);
      }
      return newLayout;
    });
  }

  function handleMoveToNewRow(colId) {
    setLayout(current => {
      if (current.length >= 4) { alert("Maximum 4 rows reached."); return current; }
      const newLayout = current.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
      return [...newLayout, [String(colId)]];
    });
  }

  // ── DRAG ─────────────────────────────────────────────────────────────────────
  function switchMode(m) {
    if (m === mode) return;
    setModeTransition(true);
    setTimeout(() => { setMode(m); setSelectedCard(null); setActiveTagFilters([]); setModeTransition(false); }, 250);
  }

  function handleDragStart({ active }) {
    if (active.data.current?.type === "column") {
      setActiveColId(active.id);
      setIsCardDrag(false);
      lastColumnOverRef.current = null;
    } else if (active.data.current?.type === "card") {
      const col = columnsRef.current.find(col => col.cards.some(c => c.id === active.id));
      dragStartColRef.current = col?.id || null;
      setActiveCard(col?.cards.find(c => c.id === active.id) || null);
      setIsCardDrag(true);
    }
  }

  function handleDragOver({ active, over }) {
    if (!over) return;

    if (active.data.current?.type === "column") {
      const overId = String(over.id);
      if (overId.startsWith("zone-") || overId.startsWith("proj-")) return;
      const activeId = String(active.id);
      if (lastColumnOverRef.current === overId) return;
      lastColumnOverRef.current = overId;

      if (rafColumnReorderRef.current) cancelAnimationFrame(rafColumnReorderRef.current);
      rafColumnReorderRef.current = requestAnimationFrame(() => {
        rafColumnReorderRef.current = null;

        if (isGridView && overId.startsWith("row-") && !isCardDrag) {
          const lyt = layoutRef.current;
          const currentRow = lyt.findIndex(row => row.includes(activeId));

          if (overId === "row-new") {
            if (lyt.length >= 4) return;
            const newLayout = lyt
              .map(row => row.filter(id => id !== activeId))
              .filter(row => row.length > 0);
            newLayout.push([activeId]);
            setLayout(newLayout);
            layoutRef.current = newLayout;
            return;
          }

          const targetRow = Number(overId.replace("row-", ""));

          if (!Number.isFinite(targetRow)) return;
          if (currentRow !== -1 && currentRow === targetRow) return;

          const newLayout = lyt
            .map(row => row.filter(id => id !== activeId))
            .filter(row => row.length > 0);

          const clamped = Math.max(0, Math.min(targetRow, newLayout.length));
          if (clamped < newLayout.length) newLayout[clamped] = [...newLayout[clamped], activeId];
          else if (newLayout.length < 4) newLayout.push([activeId]);

          setLayout(newLayout);
          layoutRef.current = newLayout;
          return;
        }
        const lyt = layoutRef.current;
        const activeRow = lyt.findIndex(row => row.includes(activeId));
        const overRow = lyt.findIndex(row => row.includes(overId));
        if (activeRow !== -1 && overRow !== -1 && activeId !== overId) {
          // Smooth cross-row + within-row ordering: insert before hovered column.
          const next = lyt.map(r => [...r]);
          // Remove active from its current row
          next[activeRow] = next[activeRow].filter(id => id !== activeId);
          // Insert into overRow at hovered index
          const insertAt = Math.max(0, next[overRow].indexOf(overId));
          next[overRow].splice(insertAt, 0, activeId);
          const cleaned = next.filter(r => r.length > 0);
          // Only update if changed to avoid jitter
          const same = JSON.stringify(cleaned) === JSON.stringify(lyt);
          if (!same) {
            setLayout(cleaned);
            layoutRef.current = cleaned;
          }
          return;
        }
        if (activeRow !== -1 && activeRow === overRow && activeId !== overId) {
          const row = lyt[activeRow];
          const fi = row.indexOf(activeId);
          const ti = row.indexOf(overId);
          if (fi !== -1 && ti !== -1 && fi !== ti) {
            const newLayout = lyt.map((r, i) => i === activeRow ? arrayMove(r, fi, ti) : r);
            setLayout(newLayout);
            layoutRef.current = newLayout; // ← sync immediately, don't wait for useEffect
          }
        }
      });
      return;
    }

    if (active.data.current?.type !== "card") return;
    if (String(over.id).startsWith("proj-")) return;

    const targetId = String(over.id).startsWith("zone-")
      ? over.id.replace("zone-", "") : over.id;

    const cols = columnsRef.current;
    const src = cols.find(col => col.cards.some(c => c.id === active.id));
    const dst = cols.find(c => c.id === targetId) || cols.find(col => col.cards.some(c => c.id === targetId));

    if (!src || !dst || src.id === dst.id || lockedCols.includes(dst.id) || lockedCols.includes(src.id)) return;

    setColumns(cols => {
      const currentSrc = cols.find(col => col.cards.some(c => c.id === active.id));
      if (!currentSrc || currentSrc.id === dst.id) return cols;
      const card = currentSrc.cards.find(c => c.id === active.id);
      if (!card) return cols;
      return cols.map(col => {
        if (col.id === currentSrc.id) return { ...col, cards: col.cards.filter(c => c.id !== active.id) };
        if (col.id === dst.id) return { ...col, cards: [...col.cards, card] };
        return col;
      });
    });
  }

  function handleDragEnd({ active, over }) {
    if (rafColumnReorderRef.current) {
      cancelAnimationFrame(rafColumnReorderRef.current);
      rafColumnReorderRef.current = null;
    }
    lastColumnOverRef.current = null;
    if (isCardDrag && over && String(over.id).startsWith("proj-")) {
      const projId = over.id.replace("proj-", "");
      // Add to project
      setProjects(ps => ps.map(p =>
        p.id !== projId ? p :
        (p.songs || []).includes(String(active.id)) ? p :
        { ...p, songs: [...(p.songs || []), String(active.id)] }
      ));
      // Restore card to its original column (handleDragOver may have moved it)
      const originalColId = dragStartColRef.current;
      if (originalColId) {
        setColumns(cols => {
          const currentCol = cols.find(col => col.cards.some(c => c.id === active.id));
          if (!currentCol || currentCol.id === originalColId) return cols;
          const card = currentCol.cards.find(c => c.id === active.id);
          if (!card) return cols;
          return cols.map(col => {
            if (col.id === currentCol.id) return { ...col, cards: col.cards.filter(c => c.id !== active.id) };
            if (col.id === originalColId) return { ...col, cards: [...col.cards, card] };
            return col;
          });
        });
      }
      setActiveCard(null); setActiveColId(null); setIsCardDrag(false);
      dragStartColRef.current = null;
      return;
    }
    // Deduplicate
    setColumns(cols => {
      const seen = new Set();
      return cols.map(col => ({ ...col, cards: col.cards.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; }) }));
    });
    setActiveCard(null); setActiveColId(null); setIsCardDrag(false);
    dragStartColRef.current = null;
  }

  // ── HANDLERS ─────────────────────────────────────────────────────────────────
  function handleSelectCard(card) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSelectedCard(card);
  }
  function handleUpdateNote(cardId, note) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, note } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, note } : prev); }
  function handleUpdateTags(cardId, tags) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, tags } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, tags } : prev); }
  function handleAddCard(colId) { const title = prompt("Project name:"); if (!title) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [...col.cards, { id: Date.now().toString(), title, daw: "fl", path: `~/Music/${title}.flp`, tags: [], note: "", date: "Just now" }] } : col)); }
  function handleDeleteCard(cardId) { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))); setSelectedCard(prev => prev?.id === cardId ? null : prev); }
  function handleRenameCol(colId, title) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, title } : col)); }
  function handleDeleteCol(colId) {
    setColumns(cols => cols.filter(col => col.id !== colId));
    setLayout(layoutRef.current.map(row => row.filter(id => id !== colId)).filter(row => row.length > 0));
  }

  function handleDuplicateCol(colId) {
    const col = columns.find(c => c.id === colId); if (!col) return;
    const newId = Date.now().toString();
    setColumns(cols => {
      const idx = cols.findIndex(c => c.id === colId);
      const next = [...cols];
      next.splice(idx + 1, 0, { ...col, id: newId, title: col.title + " (copy)", cards: col.cards.map(c => ({ ...c, id: c.id + "-" + Date.now() })) });
      return next;
    });
    setLayout(layoutRef.current.map(row => {
      const idx = row.indexOf(colId);
      if (idx === -1) return row;
      const r = [...row]; r.splice(idx + 1, 0, newId); return r;
    }));
  }
  function handleChangeColColor(colId, color) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, color } : col)); }
  function handleToggleCollapse(colId) { setCollapsedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleToggleLock(colId) { setLockedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleClearCol(colId) { setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [] } : col)); }
  async function handleOpenInDaw(filePath) { try { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.path === filePath ? { ...c, lastOpened: Date.now(), date: "Just opened" } : c) }))); await invoke("open_daw_file", { path: filePath }); } catch (e) { alert("Could not open: " + e); } }
  function handleAddProject() { const title = prompt("Project name:"); if (!title) return; const colors = [theme.accent, "#47c8ff", "#ff6b47", "#b847ff", "#3af0b0"]; setProjects(ps => [...ps, { id: Date.now().toString(), title, color: colors[ps.length % colors.length], songs: [] }]); }
  function handleAddCol() {
    const title = prompt("Column name:"); if (!title) return;
    const newId = Date.now().toString();
    setColumns(cols => [...cols, { id: newId, title, color: theme.accent, cards: [] }]);
    const lyt = layoutRef.current;
    setLayout(lyt.length > 0 ? [...lyt.slice(0, -1), [...lyt[lyt.length - 1], newId]] : [[newId]]);
  }

  function pickTargetColumnId(cols, message) {
    if (!cols || cols.length === 0) return null;
    const list = cols.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
    const input = prompt(`${message}\n\n${list}\n\nType a number (1-${cols.length}) or leave blank for the first column:`);
    if (!input) return cols[0].id;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 1 || n > cols.length) return cols[0].id;
    return cols[n - 1].id;
  }

  async function handleAddFolder() {
    const result = await pickAndScanFolder(); if (!result) return;
    setWatchedFolders(prev => [...new Set([...prev, ...result.folders])]);
    if (result.files.length === 0) { alert("No DAW projects found."); return; }
    const withMeta = await Promise.all(result.files.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    setColumns(cols => {
      if (cols.length === 0) return cols;
      const targetId = pickTargetColumnId(cols, "Add new projects into which column?");
      const existing = new Set(cols.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      alert(`Found ${newCards.length} new projects!`);
      return cols.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }
  async function handleRescan() {
    if (watchedFolders.length === 0) { alert("Add a folder first."); return; }
    const found = await scanForProjects(watchedFolders); if (found.length === 0) { alert("No new projects found."); return; }
    const withMeta = await Promise.all(found.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    setColumns(cols => {
      if (cols.length === 0) return cols;
      const targetId = pickTargetColumnId(cols, "Rescan found new projects. Add into which column?");
      const existing = new Set(cols.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      alert(`Found ${newCards.length} new projects!`);
      return cols.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }
  async function sendErrorReport() {
    if (!discordWebhook) { alert("No webhook configured. Go to Settings."); return; }
    const latest = errorLog[errorLog.length - 1];
    const ok = await postToDiscord(discordWebhook, "🟡 TrackFlow Runtime Error", `**Error:** ${latest?.message || "Unknown"}\n\`\`\`${(latest?.stack || "No stack").substring(0, 1500)}\`\`\``);
    if (ok) { setShowErrorBar(false); setErrorLog([]); } else alert("Send failed. Check webhook URL.");
  }

  const modeAccent = mode === "producer" ? theme.accent : "#47c8ff";
  const activeColData = activeColId ? columns.find(c => c.id === activeColId) : null;

  function RowDropZone({ id, children, hint }) {
    const { setNodeRef, isOver } = useDroppable({ id, disabled: !isGridView || isCardDrag });
    const showHint = Boolean(hint) && activeColId && !isCardDrag;
    return (
      <div
        ref={setNodeRef}
        style={{
          borderRadius: theme.r2,
          outline: isOver ? `1px solid ${theme.accent}66` : "none",
          background: isOver ? `rgba(${theme.accentRgb},0.035)` : "transparent",
          transition: "outline 0.12s, background 0.12s",
        }}
      >
        {children}
        {showHint && (
          <div
            style={{
              height: 34,
              marginTop: 8,
              borderRadius: theme.r2,
              border: `1px dashed ${theme.border}`,
              color: theme.text3,
              opacity: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.04em",
              userSelect: "none",
            }}
          >
            {hint}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font || "Syne", background: theme.bg, color: theme.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", transition: "background 0.3s" }}>
      {showTagManager && <TagManager allTags={customTags} onAddTag={tag => { if (!customTags.find(t => t.label === tag.label)) setCustomTags(p => [...p, tag]); }} onDeleteTag={l => setCustomTags(p => p.filter(t => t.label !== l))} onClose={() => setShowTagManager(false)} theme={theme} />}
      {showThemeCustomizer && <ThemeCustomizer themePreset={themePreset} themeCustom={themeCustom} font={font} onApply={(preset, custom, f) => { setThemePreset(preset); setThemeCustom(custom); setFont(f); setShowThemeCustomizer(false); }} onClose={() => setShowThemeCustomizer(false)} theme={theme} />}
      {showSettings && <SettingsPanel discordWebhook={discordWebhook} colMaxHeight={colMaxHeight} onSave={(wh, mh) => { setDiscordWebhook(wh); setWebhookUrl(wh); setColMaxHeight(mh); setShowSettings(false); }} onClose={() => setShowSettings(false)} theme={theme} />}

      {/* Error bar */}
      {showErrorBar && (
        <div style={{ background: "#c0392b", padding: "7px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 12, color: "#fff", fontWeight: 600 }}>⚠ Runtime error detected</span>
          <button onClick={sendErrorReport} style={{ padding: "4px 12px", background: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#c0392b" }}>Send Error Report</button>
          <button onClick={() => setShowErrorBar(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ height: 50, background: theme.surface, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, letterSpacing: "-0.5px" }}>Track<span style={{ color: modeAccent }}>Flow</span></div>
        <div style={{ display: "flex", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: 3, gap: 2 }}>
          {[{ key: "producer", icon: Icons.producer, label: "Producer" }, { key: "engineer", icon: Icons.engineer, label: "Engineer" }].map(m => (
            <button key={m.key} onClick={() => switchMode(m.key)} style={{ padding: "4px 12px", borderRadius: theme.r - 2, border: "none", background: mode === m.key ? theme.surface3 : "transparent", color: mode === m.key ? (m.key === "producer" ? theme.accent : "#47c8ff") : theme.text3, fontFamily: font || "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              <Icon d={m.icon} size={12} />{m.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />

        {/* Search input */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Icon d={Icons.search} size={12} style={{ position: "absolute", left: 9, color: searchQuery ? theme.accent : theme.text3, pointerEvents: "none", transition: "color 0.15s" }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            style={{ background: theme.surface2, border: `1px solid ${searchQuery ? theme.accent + "60" : theme.border}`, borderRadius: theme.r, padding: "5px 28px 5px 28px", color: theme.text, fontFamily: font || "Syne", fontSize: 12, outline: "none", width: searchQuery ? 180 : 140, transition: "width 0.2s, border-color 0.2s" }}
          />
          {searchQuery && (
            <div onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, cursor: "pointer", color: theme.text3, display: "flex" }} onMouseEnter={e => e.currentTarget.style.color = theme.text} onMouseLeave={e => e.currentTarget.style.color = theme.text3}>
              <Icon d={Icons.close} size={10} />
            </div>
          )}
        </div>

        {/* Unified sort + filter dropdown */}
        <SortFilterDropdown sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} allTags={customTags} activeTagFilters={activeTagFilters} setActiveTagFilters={setActiveTagFilters} theme={theme} />

        {watchedFolders.length > 0 && <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{watchedFolders.length} folder{watchedFolders.length > 1 ? "s" : ""} watched</div>}
        {[
          { icon: Icons.backup, action: async () => { const p = await backupState(); if (p) alert(`Backup saved:\n${p}`); }, hover: theme.accent, title: "Backup" },
          { icon: Icons.theme, action: () => setShowThemeCustomizer(true), hover: theme.accent, title: "Customize Theme" },
          { icon: Icons.tag, action: () => setShowTagManager(true), hover: "#b847ff", title: "Manage Tags" },
          { icon: Icons.folder, action: handleAddFolder, hover: "#47c8ff", title: "Add Folder" },
          { icon: Icons.scan, action: handleRescan, hover: theme.accent, title: "Rescan" },
          { icon: Icons.settings, action: () => setShowSettings(true), hover: theme.text2, title: "Settings" },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title} style={{ width: 32, height: 32, borderRadius: theme.r, border: `1px solid ${theme.border}`, background: theme.surface2, color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = btn.hover} onMouseLeave={e => e.currentTarget.style.color = theme.text2}>
            <Icon d={btn.icon} size={13} />
          </button>
        ))}
        <div
          title={user ? `Signed in as ${user.email}` : "Offline mode"}
          onClick={user ? signOut : undefined}
          style={{ width: 28, height: 28, borderRadius: "50%", background: user ? `linear-gradient(135deg, ${theme.accent}, #47c8ff)` : theme.surface3, border: user ? "none" : `1px solid ${theme.border2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: user ? theme.accentText : theme.text3, cursor: user ? "pointer" : "default", flexShrink: 0 }}
          onMouseEnter={e => { if (user) e.currentTarget.style.opacity = "0.8"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
          {initial ?? "~"}
        </div>
      </div>

      <div style={{ height: 2, background: `linear-gradient(90deg, ${modeAccent}99, transparent)`, flexShrink: 0 }} />

      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const type = args.active?.data?.current?.type;
          // closestCenter is more forgiving when dropping into nearby columns (esp. vertically)
          return (type === "column" || type === "card") ? closestCenter(args) : rectIntersection(args);
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ProjectSidebar projects={projects} onAddProject={handleAddProject} onDeleteProject={id => setProjects(ps => ps.filter(p => p.id !== id))} onAddSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: [...(p.songs || []), songId] } : p))} onRemoveSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: (p.songs || []).filter(s => s !== songId) } : p))} onRenameProject={(id, title) => setProjects(ps => ps.map(p => p.id === id ? { ...p, title } : p))} theme={theme} allColumns={[...producerCols, ...engineerCols]} isCardDrag={isCardDrag} collapsed={projectsCollapsed} onToggleCollapsed={() => setProjectsCollapsed(v => !v)} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", opacity: modeTransition ? 0 : 1, transition: "opacity 0.25s", background: mode === "producer" ? theme.glow : theme.glow2 }}>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, minWidth: "fit-content" }}>
              {layout.map((rowColIds, rowIdx) => (
                <RowDropZone key={rowIdx} id={`row-${rowIdx}`}>
                  <SortableContext items={rowColIds} strategy={horizontalListSortingStrategy}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      {rowColIds.map(colId => {
                        const col = columns.find(c => c.id === colId);
                        if (!col) return null;
                        return (
                          <SortableColumn key={col.id} col={col}
                            selectedCard={selectedCard} onSelectCard={handleSelectCard}
                            onAddCard={handleAddCard} onDeleteCard={handleDeleteCard}
                            onRenameCol={handleRenameCol} onDeleteCol={handleDeleteCol}
                            onDuplicateCol={handleDuplicateCol} onChangeColor={handleChangeColColor}
                            onToggleCollapse={handleToggleCollapse} onToggleLock={handleToggleLock}
                            onClearCol={handleClearCol}
                            onMoveRowUp={handleMoveRowUp} onMoveRowDown={handleMoveRowDown} onMoveToNewRow={handleMoveToNewRow}
                            allTags={customTags} sortBy={sortBy} sortDir={sortDir}
                            activeFilters={activeTagFilters} searchQuery={searchQuery} theme={theme}
                            isCardDrag={isCardDrag}
                            isCollapsed={collapsedCols.includes(col.id)} isLocked={lockedCols.includes(col.id)}
                            colMaxHeight={colMaxHeight}
                            canMoveUp={isGridView && rowIdx > 0} canMoveDown={isGridView && (layout.length < 4 || rowIdx < layout.length - 1)} />
                        );
                      })}
                      {rowIdx === layout.length - 1 && (
                        <button onClick={handleAddCol} style={{ flexShrink: 0, width: 46, minHeight: 80, background: "transparent", border: `1px dashed ${theme.border}`, borderRadius: theme.r2, color: theme.text3, opacity: 0.55, cursor: "pointer", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s, border-color 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = 0.9; e.currentTarget.style.borderColor = theme.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.borderColor = theme.border; }}>
                          <Icon d={Icons.plus} size={18} />
                        </button>
                      )}
                    </div>
                  </SortableContext>
                </RowDropZone>
              ))}

              {isGridView && layout.length < 4 && (
                <RowDropZone id="row-new" hint="Drop a column here to create a new row" />
              )}
            </div>

            <DragOverlay>
              {activeCard && <div style={{ width: 260, opacity: 0.95, transform: "rotate(1.5deg)" }}><CardContent card={activeCard} isDragging allTags={customTags} theme={theme} /></div>}
              {activeColData && (
                <div style={{
                  width: 285,
                  transform: "scale(1.05)",
                  transformOrigin: "center top",
                  boxShadow: "0 28px 70px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
                  background: theme.surface,
                  border: `1px solid ${theme.accent}90`,
                  borderRadius: theme.r2,
                  padding: "12px 14px",
                  cursor: "grabbing",
                  willChange: "transform",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{activeColData.title}</div>
                  <div style={{ fontSize: 11, color: theme.text3, marginTop: 4 }}>{activeColData.cards.length} projects</div>
                </div>
              )}
            </DragOverlay>
          </div>

          <DetailPanel card={selectedCard} onUpdateNote={handleUpdateNote} onUpdateTags={handleUpdateTags} onOpenInDaw={handleOpenInDaw} allTags={customTags} theme={theme} />
        </div>
      </DndContext>
    </div>
  );
}

export default App;

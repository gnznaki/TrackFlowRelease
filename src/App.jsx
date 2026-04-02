import { saveState, loadState, backupState } from "./storage";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { scanForProjects, pickAndScanFolder } from "./scanner";
import { monitorForElements, dropTargetForElements, draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { buildTheme, BASE_PRESETS, FONT_WEIGHTS } from "./lib/theme";
import { PRODUCER_COLUMNS, ENGINEER_COLUMNS, DEFAULT_TAGS, DEFAULT_COL_HEIGHT } from "./lib/constants";
import { migrateState } from "./lib/migrate";
import { useFlip } from "./hooks/useFlip";
import { postToDiscord } from "./lib/discord";
import { supabase } from "./lib/supabase";
import { DraggableColumn } from "./components/Column";
import ProjectSidebar from "./components/ProjectSidebar";
import DetailPanel from "./components/DetailPanel";
import ThemeCustomizer from "./components/ThemeCustomizer";
import SettingsPanel from "./components/SettingsPanel";
import TagManager from "./components/TagManager";
import SortFilterDropdown from "./components/SortFilterDropdown";
import { Icon, Icons } from "./components/Icon";
import { AuthScreenInner } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";
import { useCollabBoard } from "./hooks/useCollabBoard";
import { useTier } from "./hooks/useTier";
import ShareModal from "./components/ShareModal";
import UpgradeModal from "./components/UpgradeModal";
import ConfirmModal from "./components/ConfirmModal";
import ProfileModal, { AVATAR_GRADIENTS } from "./components/ProfileModal";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import NamePromptModal from "./components/NamePromptModal";
import ContactModal from "./components/ContactModal";
import { deleteAccount, openCustomerPortal } from "./lib/stripe";
import TutorialModal from "./components/TutorialModal";
import "./App.css";

function hexToRgbInline(hex) {
  const h = (hex || "#888888").replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// Modal shown when a card or column is dropped onto a different page
function CrossPageModal({ type, itemName, fromPage, toPage, onMove, onDuplicate, onCancel, theme }) {
  const C = theme;
  const label = type === "column" ? "column" : "track";
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10020, fontFamily: C.font || "Syne" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ width: 380, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 3 }}>
            Drop to <span style={{ color: C.accent }}>{toPage}</span>
          </div>
          <div style={{ fontSize: 11, color: C.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {itemName}
          </div>
        </div>
        <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>
            What would you like to do with this {label}?
          </div>
          <button onClick={onMove}
            style={{ width: "100%", padding: "10px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", paddingLeft: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
            <span>
              Move to <strong>{toPage}</strong>
              <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.75, display: "block" }}>Removes it from {fromPage}</span>
            </span>
          </button>
          <button onClick={onDuplicate}
            style={{ width: "100%", padding: "10px 0", background: "transparent", border: `1px solid ${C.border2}`, borderRadius: C.r, color: C.text, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", paddingLeft: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>⎘</span>
            <span>
              Duplicate to <strong>{toPage}</strong>
              <span style={{ fontWeight: 400, fontSize: 11, color: C.text3, display: "block" }}>Keeps a copy in {fromPage}</span>
            </span>
          </button>
          <button onClick={onCancel}
            style={{ width: "100%", padding: "8px 0", background: "transparent", border: "none", color: C.text3, fontFamily: C.font || "Syne", fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Page tab that doubles as a drop target during drags — switching to that page on hover.
function PageDragTab({ page, pageIndex, isActive, onSwitchForDrag, onClick, onDoubleClick, onContextMenu, editingPageId, onRename, onStopEdit, theme, font, isShared, collabMembers, tabDragVisual, onTabMouseDown }) {
  const ref = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const onSwitchRef = useRef(onSwitchForDrag);
  useEffect(() => { onSwitchRef.current = onSwitchForDrag; }, [onSwitchForDrag]);
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Pragmatic DnD — only for card/column drops onto this tab (page switching)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ type: "page-tab", pageId: page.id }),
      canDrop: ({ source }) => source.data.type === "card" || source.data.type === "column",
      onDragEnter: () => { setIsDragOver(true); if (!isActiveRef.current) onSwitchRef.current(page.id); },
      onDragLeave: () => setIsDragOver(false),
      onDrop: () => setIsDragOver(false),
    });
  }, [page.id]);

  const tabColor = theme.accent;

  // Chrome-style sliding: compute translateX shift based on drag position
  let shiftX = 0;
  const isPlaceholder = tabDragVisual?.draggingId === page.id;
  if (tabDragVisual && !isPlaceholder) {
    const { fromIdx, slotIdx, tabWidth } = tabDragVisual;
    const i = pageIndex;
    if (slotIdx > fromIdx && i > fromIdx && i <= slotIdx) shiftX = -tabWidth;
    else if (slotIdx < fromIdx && i >= slotIdx && i < fromIdx) shiftX = tabWidth;
  }

  return (
    <div
      ref={ref}
      data-tab-id={page.id}
      onMouseDown={e => onTabMouseDown(e, page.id)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        position: "relative",
        padding: "4px 10px", borderRadius: theme.r - 2,
        background: isPlaceholder ? "transparent" : isActive ? theme.surface3 : isDragOver ? `${tabColor}20` : "transparent",
        color: isActive ? tabColor : isDragOver ? tabColor : theme.text3,
        fontFamily: font || "Syne", fontSize: 12, fontWeight: 600,
        cursor: tabDragVisual ? (isPlaceholder ? "grabbing" : "default") : "grab",
        display: "flex", alignItems: "center", gap: 6, userSelect: "none",
        outline: isDragOver && !tabDragVisual ? `1px solid ${tabColor}55` : "none",
        opacity: isPlaceholder ? 0 : 1,
        pointerEvents: isPlaceholder ? "none" : "auto",
        transform: `translateX(${shiftX}px)`,
        transition: tabDragVisual ? "transform 0.15s ease" : "background 0.1s, color 0.1s",
        zIndex: isPlaceholder ? 0 : 1,
      }}
    >
      {isShared
        ? <svg width="11" height="9" viewBox="0 0 22 18" fill="none" style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }}>
            <circle cx="7" cy="5" r="4" fill={tabColor} />
            <circle cx="15" cy="5" r="4" fill={tabColor} opacity="0.6" />
            <ellipse cx="7" cy="14" rx="6" ry="4" fill={tabColor} />
            <ellipse cx="15" cy="14" rx="6" ry="4" fill={tabColor} opacity="0.6" />
          </svg>
        : <div style={{ width: 7, height: 7, borderRadius: "50%", background: tabColor, flexShrink: 0, opacity: isActive ? 1 : isDragOver ? 0.8 : 0.45, transition: "opacity 0.15s" }} />
      }
      {editingPageId === page.id ? (
        <input
          autoFocus
          defaultValue={page.name}
          onBlur={e => { onRename(page.id, e.target.value); onStopEdit(); }}
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") onStopEdit(); e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          style={{ width: 80, background: "transparent", border: "none", borderBottom: `1px solid ${tabColor}`, color: "inherit", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", outline: "none", padding: 0 }}
        />
      ) : (
        <span style={{ textShadow: isShared ? `0 0 6px ${tabColor}99` : "none" }}>{page.name}</span>
      )}
      {isShared && isActive && collabMembers?.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", marginLeft: 2 }}>
          {collabMembers.slice(0, 3).map((m, i) => {
            const GRADS = [{ key: "lime", a: "#c8ff47", b: "#3af0b0" }, { key: "blue", a: "#47c8ff", b: "#4780ff" }, { key: "purple", a: "#b847ff", b: "#ff47b8" }, { key: "orange", a: "#ff6b47", b: "#ffb347" }, { key: "teal", a: "#3af0b0", b: "#00c8ff" }, { key: "rose", a: "#ff4780", b: "#ff7447" }];
            const grad = GRADS.find(g => g.key === (m.profile?.avatar_color || "lime")) || GRADS[0];
            return (
              <div key={m.user_id} title={m.profile?.display_name || m.profile?.email || "Member"} style={{ width: 13, height: 13, borderRadius: "50%", background: `linear-gradient(135deg, ${grad.a}, ${grad.b})`, border: `1.5px solid ${theme.surface}`, marginLeft: i === 0 ? 0 : -4, zIndex: collabMembers.length - i, position: "relative", flexShrink: 0, overflow: "hidden" }}>
                {m.profile?.avatar_url && <img src={m.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </div>
            );
          })}
          {collabMembers.length > 3 && <div style={{ width: 13, height: 13, borderRadius: "50%", background: theme.surface3, border: `1.5px solid ${theme.surface}`, marginLeft: -4, fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text3, fontWeight: 700 }}>+{collabMembers.length - 3}</div>}
        </div>
      )}
    </div>
  );
}

// Defined outside App so React sees a stable component reference across renders.
// If defined inside App, React remounts it (and all its children) on every render,
// which resets the scroll position of every CardDropZone in every column.
function RowDropZone({ rowIdx, isNewRow, onColOverRow, children, hint, isGridView, isCardDrag, activeColId, theme }) {
  const ref = useRef(null);
  const [isOver, setIsOver] = useState(false);
  const onColOverRowRef = useRef(onColOverRow);
  useEffect(() => { onColOverRowRef.current = onColOverRow; }, [onColOverRow]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isGridView || isCardDrag) return;
    const data = isNewRow ? { type: "row-new" } : { type: "row", rowIdx };
    return dropTargetForElements({
      element: el,
      getData: () => data,
      canDrop: ({ source }) => source.data.type === "column",
      onDragEnter: ({ source }) => {
        setIsOver(true);
        if (source.data.type === "column") {
          onColOverRowRef.current?.(source.data.colId, rowIdx, isNewRow);
        }
      },
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [isGridView, isCardDrag, rowIdx, isNewRow]);

  const showHint = Boolean(hint) && activeColId && !isCardDrag;
  return (
    <div ref={ref} style={{ borderRadius: theme.r2, outline: isOver ? `1px solid ${theme.accent}66` : "none", background: isOver ? `rgba(${theme.accentRgb},0.035)` : "transparent", transition: "outline 0.12s, background 0.12s" }}>
      {children}
      {showHint && (
        <div style={{ height: 34, marginTop: 8, borderRadius: theme.r2, border: `1px dashed ${theme.border}`, color: theme.text3, opacity: 0.75, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.04em", userSelect: "none" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// Column picker modal — replaces window.prompt() for rescan/add-folder flows
function ColumnPickerModal({ cols, message, onPick, onCancel, theme }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 24, width: 340, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 }}>{message}</div>
        <div style={{ fontSize: 12, color: theme.text3, marginBottom: 18 }}>Select a column below.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cols.map(col => (
            <button
              key={col.id}
              onClick={() => onPick(col.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = col.color + "80"; e.currentTarget.style.background = theme.surface3; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.surface2; }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.text }}>{col.title}</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: theme.text3, background: theme.surface3, padding: "2px 7px", borderRadius: 8 }}>{col.cards.length}</span>
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ marginTop: 14, width: "100%", padding: "8px", background: "transparent", border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text3, cursor: "pointer", fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function makeDefaultPages() {
  return [
    { id: "producer", name: "Producer", color: "#c8ff47", boardId: crypto.randomUUID(), columns: PRODUCER_COLUMNS, layout: [PRODUCER_COLUMNS.map(c => c.id)] },
    { id: "engineer", name: "Engineer", color: "#47c8ff", boardId: crypto.randomUUID(), columns: ENGINEER_COLUMNS, layout: [ENGINEER_COLUMNS.map(c => c.id)] },
  ];
}

function App() {
  const { user, loading: authLoading, initial, signIn, signUp, signOut, resetPassword } = useAuth();
  const [ready, setReady] = useState(false);

  // ── PAGES STATE ───────────────────────────────────────────────────────────
  const [pages, setPages] = useState(makeDefaultPages);
  const [currentPageId, setCurrentPageId] = useState("producer");
  const [pageContextMenu, setPageContextMenu] = useState(null); // { pageId, x, y }
  const [boardContextMenu, setBoardContextMenu] = useState(null); // { x, y, rowIdx? }
  const [editingPageId, setEditingPageId] = useState(null);

  const [layoutView, setLayoutView] = useState("grid");
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [watchedFolders, setWatchedFolders] = useState([]);
  const [customTags, setCustomTags] = useState(DEFAULT_TAGS);
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [activeColId, setActiveColId] = useState(null);
  const [isCardDrag, setIsCardDrag] = useState(false);
  const [crossPageDrop, setCrossPageDrop] = useState(null); // { type, itemName, fromPageId, fromPageName, toPageId, toPageName, cardId?, card?, colId?, col? }
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [themePreset, setThemePreset] = useState("default");
  const [themeCustom, setThemeCustom] = useState(BASE_PRESETS.default);
  const [font, setFont] = useState("Syne");
  const [colMaxHeight, setColMaxHeight] = useState(DEFAULT_COL_HEIGHT);
  const [sortBy, setSortBy] = useState("default");
  const [sortDir, setSortDir] = useState("desc");
  const [modeTransition, setModeTransition] = useState(false);
  const [activeTagFilters, setActiveTagFilters] = useState([]);
  const [activeProjectFilters, setActiveProjectFilters] = useState([]); // project IDs
  const [collapsedCols, setCollapsedCols] = useState([]);
  const [lockedCols, setLockedCols] = useState([]);
  const [showContact, setShowContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorLog, setErrorLog] = useState([]);
  const [showErrorBar, setShowErrorBar] = useState(false);
  const [sharedBoards, setSharedBoards] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null); // { title, message, confirmLabel, onConfirm }
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [namePrompt, setNamePrompt] = useState(null); // { title, hint, placeholder, resolve }
  const colFlip = useFlip();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [colPickerState, setColPickerState] = useState(null); // { cols, message, resolve }

  const { tier, isPaid, isPremium, displayName, avatarColor, avatarUrl, createdAt, invitesDisabled, updateDisplayName, updateAvatarColor, updateAvatarUrl, updateInvitesDisabled } = useTier(user?.id);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [cardClipboard, setCardClipboard] = useState(null); // copied card

  // ── DERIVED CURRENT PAGE ──────────────────────────────────────────────────
  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];
  const columns = currentPage?.columns || [];
  const layout = currentPage?.layout || [];
  const isGridView = layoutView === "grid";
  const pageIndex = pages.findIndex(p => p.id === currentPageId);
  const theme = buildTheme(themeCustom.bg, themeCustom.cardBg, themeCustom.borderHex, themeCustom.accent, font);

  // Ref to always have current pageId inside callbacks without stale closures
  const currentPageIdRef = useRef(currentPageId);
  useEffect(() => { currentPageIdRef.current = currentPageId; }, [currentPageId]);

  // Per-page column/layout setters
  function setColumns(updater) {
    const pid = currentPageIdRef.current;
    setPages(ps => ps.map(p => p.id !== pid ? p : {
      ...p,
      columns: typeof updater === "function" ? updater(p.columns) : updater,
    }));
  }

  function setLayout(updater) {
    const pid = currentPageIdRef.current;
    setPages(ps => ps.map(p => p.id !== pid ? p : {
      ...p,
      layout: typeof updater === "function" ? updater(p.layout) : updater,
    }));
  }

  // ── ALL HOOKS BEFORE EARLY RETURN ─────────────────────────────────────────
  const columnsRef = useRef(columns);
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  const lockedColsRef = useRef(lockedCols);
  useEffect(() => { lockedColsRef.current = lockedCols; }, [lockedCols]);
  const dragStartColRef = useRef(null);
  const dragStartRowRef = useRef(null);
  const dragStartPageRef = useRef(null);
  const dragCardRef = useRef(null);
  const savedGridLayoutRef = useRef({});

  // ── CUSTOM CARD-DRAG COLUMN SCROLL ────────────────────────────────────────
  // dnd-kit's built-in autoScroll traverses outermost containers first, so it
  // scrolls the main content area instead of the column. We replace it with a
  // RAF loop that always scrolls the innermost scrollable element under the pointer.
  const cardDragPointer = useRef({ x: 0, y: 0 });
  const cardScrollRaf = useRef(null);

  useEffect(() => {
    if (!isCardDrag) {
      if (cardScrollRaf.current) { cancelAnimationFrame(cardScrollRaf.current); cardScrollRaf.current = null; }
      return;
    }

    function onMove(e) { cardDragPointer.current = { x: e.clientX, y: e.clientY }; }
    window.addEventListener("pointermove", onMove, { passive: true });

    function loop() {
      const { x, y } = cardDragPointer.current;
      // Vertical: scroll innermost scrollable column under the pointer
      const hit = document.elementFromPoint(x, y);
      let el = hit;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
          const rect = el.getBoundingClientRect();
          const ZONE = 56;
          if (y < rect.top + ZONE) {
            el.scrollTop -= Math.round(8 * (1 - (y - rect.top) / ZONE));
          } else if (y > rect.bottom - ZONE) {
            el.scrollTop += Math.round(8 * (1 - (rect.bottom - y) / ZONE));
          }
          break;
        }
        el = el.parentElement;
      }
      // Horizontal: scroll board when pointer is near left/right edge
      const board = document.querySelector("[data-board-scroll]");
      if (board) {
        const br = board.getBoundingClientRect();
        const HZONE = 80;
        if (x > br.right - HZONE) {
          board.scrollLeft += Math.round(10 * (1 - Math.max(0, br.right - x) / HZONE));
        } else if (x < br.left + HZONE) {
          board.scrollLeft -= Math.round(10 * (1 - Math.max(0, x - br.left) / HZONE));
        }
      }
      cardScrollRaf.current = requestAnimationFrame(loop);
    }
    cardScrollRaf.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (cardScrollRaf.current) { cancelAnimationFrame(cardScrollRaf.current); cardScrollRaf.current = null; }
    };
  }, [isCardDrag]);

  // Per-board tag cache: when a shared board broadcasts its customTags, store them
  // keyed by boardId so viewers see the owner's tag colors on that board.
  const [sharedBoardTags, setSharedBoardTags] = useState({}); // { [boardId]: tags[] }

  // Single collab board hook for the current page
  const handleRemoteUpdate = useCallback((cols, lyt, tags) => {
    const pid = currentPageIdRef.current;
    setPages(ps => ps.map(p => p.id === pid ? { ...p, columns: cols, layout: lyt } : p));
    if (tags?.length) {
      const page = pagesRef.current.find(p => p.id === pid);
      if (page?.boardId) setSharedBoardTags(prev => ({ ...prev, [page.boardId]: tags }));
    }
  }, []);

  const { shareBoard, joinBoard, leaveBoard, stopSharing, deleteBoard, fetchMembers, refreshMembers, updateMemberRole, removeMember, addMemberByEmail, toggleBoardLock, getSentInvites, members: collabMembers, myRole, boardLocked, boardDeletedByOwner } = useCollabBoard({
    boardId: currentPage?.boardId,
    isShared: sharedBoards.includes(currentPage?.boardId),
    columns,
    layout,
    tags: customTags,
    mode: currentPageId,
    onRemoteUpdate: handleRemoteUpdate,
  });

  const currentBoardId = currentPage?.boardId;
  const isCurrentBoardShared = sharedBoards.includes(currentBoardId);
  // Viewers see the board but cannot drag or edit.
  // isEffectiveViewer also activates when the owner has locked the board.
  const isViewer = isCurrentBoardShared && myRole === "viewer";
  const isEffectiveViewer = isViewer || (isCurrentBoardShared && boardLocked);
  const isViewerRef = useRef(false);
  useEffect(() => { isViewerRef.current = isEffectiveViewer; }, [isEffectiveViewer]);

  // When viewing a shared board, merge the owner's broadcast tags (keyed by boardId)
  // with local customTags so the viewer sees correct tag colors. Local tags take precedence
  // for label conflicts (the viewer may have their own custom colors).
  const effectiveTags = (() => {
    if (!isCurrentBoardShared || !currentBoardId) return customTags;
    const boardTags = sharedBoardTags[currentBoardId] || [];
    if (!boardTags.length) return customTags;
    // Merge: start from boardTags (owner's), overlay any local overrides by label
    const localMap = Object.fromEntries(customTags.map(t => [t.label, t]));
    const merged = boardTags.map(t => localMap[t.label] || t);
    // Add any local-only tags not in the board set
    const boardLabels = new Set(boardTags.map(t => t.label));
    customTags.forEach(t => { if (!boardLabels.has(t.label)) merged.push(t); });
    return merged;
  })();

  async function handleShareBoard() {
    const result = await shareBoard(currentPage?.name || "Board");
    if (result?.error) return result.error;
    setSharedBoards(prev => [...new Set([...prev, currentBoardId])]);
    return null;
  }

  async function handleJoinBoard(code) {
    const { board, error } = await joinBoard(code);
    if (error) return error;
    const palette = ["#b847ff", "#ff6b47", "#3af0b0", "#ff4780", "#c8ff47", "#47c8ff"];
    const usedColors = new Set(pagesRef.current.map(p => p.color));
    const nextColor = palette.find(c => !usedColors.has(c)) || palette[pagesRef.current.length % palette.length];
    const newPage = {
      id: Date.now().toString(),
      name: board.name || "Shared Board",
      color: nextColor,
      boardId: board.id,
      columns: board.columns,
      layout: board.layout,
    };
    setPages(ps => [...ps, newPage]);
    setCurrentPageId(newPage.id);
    setSharedBoards(prev => [...new Set([...prev, board.id])]);
    return null;
  }

  async function handleLeaveBoard(boardId) {
    await leaveBoard(boardId);
    setSharedBoards(prev => prev.filter(id => id !== boardId));
    // Remove the page and switch to another if it was active
    const leavingPageId = pagesRef.current.find(p => p.boardId === boardId)?.id;
    const remaining = pagesRef.current.filter(p => p.boardId !== boardId);
    setPages(remaining);
    if (leavingPageId === currentPageIdRef.current) {
      setCurrentPageId(remaining[0]?.id ?? null);
    }
  }

  // "Remove Sharing" — kicks all collaborators but the owner keeps their board tab locally.
  // The shared_boards record is NOT deleted so the owner can reshare whenever.
  async function handleStopSharing(boardId) {
    await stopSharing(boardId);
    // Remove boardId from sharedBoards so this tab reverts to local mode
    setSharedBoards(prev => prev.filter(id => id !== boardId));
  }

  // ── INVITE SYSTEM ─────────────────────────────────────────────────────────
  async function fetchMyInvites() {
    if (!supabase || !user) return;
    const { data, error } = await supabase.rpc("get_my_invites");
    if (!error) setPendingInvites(data || []);
  }

  async function fetchSentInvites() {
    if (myRole !== "owner") return;
    const list = await getSentInvites();
    setSentInvites(list);
  }

  async function handleRespondToInvite(inviteId, accept) {
    if (!supabase) return;
    const { data } = await supabase.rpc("respond_to_invite", {
      p_invite_id: inviteId,
      p_accept: accept,
    });
    await fetchMyInvites();
    if (accept && data && !data.error) {
      const { data: board } = await supabase
        .from("shared_boards")
        .select("id, name, columns, layout, mode, locked")
        .eq("id", data.board_id)
        .single();
      if (board) {
        const palette = ["#b847ff", "#ff6b47", "#3af0b0", "#ff4780", "#c8ff47", "#47c8ff"];
        const usedColors = new Set(pagesRef.current.map(p => p.color));
        const nextColor = palette.find(c => !usedColors.has(c)) || palette[pagesRef.current.length % palette.length];
        const newPage = {
          id: Date.now().toString(),
          name: board.name || data.board_name || "Shared Board",
          color: nextColor,
          boardId: board.id,
          columns: board.columns,
          layout: board.layout,
        };
        setPages(ps => [...ps, newPage]);
        setCurrentPageId(newPage.id);
        setSharedBoards(prev => [...new Set([...prev, board.id])]);
      }
    }
  }

  // Hard delete — removes the board record entirely (not exposed in UI for now, kept for internal use)
  async function handleDeleteBoard(boardId) {
    await deleteBoard(boardId);
    setSharedBoards(prev => prev.filter(id => id !== boardId));
    const leavingPageId = pagesRef.current.find(p => p.boardId === boardId)?.id;
    const remaining = pagesRef.current.filter(p => p.boardId !== boardId);
    setPages(remaining);
    if (leavingPageId === currentPageIdRef.current) {
      setCurrentPageId(remaining[0]?.id ?? null);
    }
  }

  // When the owner deletes the shared board, collaborators receive board_deleted
  // broadcast and boardDeletedByOwner flips to true — remove their page too.
  useEffect(() => {
    if (!boardDeletedByOwner) return;
    const bId = currentPage?.boardId;
    if (!bId) return;
    setSharedBoards(prev => prev.filter(id => id !== bId));
    const leavingPageId = pagesRef.current.find(p => p.boardId === bId)?.id;
    const remaining = pagesRef.current.filter(p => p.boardId !== bId);
    setPages(remaining);
    if (leavingPageId === currentPageIdRef.current) {
      setCurrentPageId(remaining[0]?.id ?? null);
    }
  }, [boardDeletedByOwner]);

  // Refresh members list every time the share modal is opened — ensures the
  // owner always sees the latest list even if realtime events were missed.
  // Also refresh pending invites so the notification count stays current.
  useEffect(() => {
    if (showShareModal && isCurrentBoardShared) { refreshMembers(); fetchSentInvites(); }
    if (showShareModal) fetchMyInvites();
  }, [showShareModal]);

  // When a collaborator joins (collabMembers updates via member_joined broadcast),
  // refresh sentInvites so the greyed-out pending entry disappears automatically.
  useEffect(() => {
    if (myRole === "owner" && isCurrentBoardShared) fetchSentInvites();
  }, [collabMembers]);

  // Fetch invites on login (so the notification badge appears immediately)
  useEffect(() => {
    if (user) fetchMyInvites();
  }, [user?.id]);

  function requestConfirm({ title, message, confirmLabel = "Confirm", onConfirm }) {
    setPendingConfirm({ title, message, confirmLabel, onConfirm });
  }

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
    const available = Math.max(500, window.innerWidth - 560);
    const colW = 285;
    const gap = 14;
    const perRow = Math.max(1, Math.min(6, Math.floor((available + gap) / (colW + gap))));
    const rows = [];
    for (let i = 0; i < order.length; i += perRow) rows.push(order.slice(i, i + perRow));
    return rows.slice(0, 4);
  }

  const applyResponsiveLayout = useCallback((nextView) => {
    const pid = currentPageIdRef.current;
    const colIds = columnsRef.current.map(c => String(c.id));
    const current = normalizeLayout(layoutRef.current, colIds);

    if (nextView === "panel") {
      savedGridLayoutRef.current[pid] = current;
      const panelLayout = [flattenLayout(current)];
      setPages(ps => ps.map(p => p.id === pid ? { ...p, layout: panelLayout } : p));
      layoutRef.current = panelLayout;
      return;
    }

    const saved = savedGridLayoutRef.current[pid];
    const restored = saved ? normalizeLayout(saved, colIds) : computeGridLayoutFromOrder(flattenLayout(current));
    setPages(ps => ps.map(p => p.id === pid ? { ...p, layout: restored } : p));
    layoutRef.current = restored;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The app's minimum window width is 900px (tauri.conf.json minWidth).
    // Keep the threshold well below that so snapping to half-screen never
    // collapses multi-row layouts. Panel mode is only for very narrow contexts.
    function decideView() {
      const next = window.innerWidth < 600 ? "panel" : "grid";
      setLayoutView(prev => (prev === next ? prev : next));
    }
    decideView();
    window.addEventListener("resize", decideView);
    return () => window.removeEventListener("resize", decideView);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyResponsiveLayout(layoutView);
  }, [ready, layoutView, applyResponsiveLayout]);

  function applyLoadedState(saved) {
    if (!saved) return;
    setPages(saved.pages);
    setCurrentPageId(saved.currentPageId || saved.pages[0]?.id || "producer");
    setProjects(saved.projects);
    setWatchedFolders(saved.watchedFolders);
    setCustomTags(saved.customTags);
    setThemePreset(saved.themePreset);
    setThemeCustom(saved.themeCustom);
    setFont(saved.font);
    setColMaxHeight(saved.colMaxHeight);
    setCollapsedCols(saved.collapsedCols);
    setLockedCols(saved.lockedCols);
    if (saved.sharedBoards) setSharedBoards(saved.sharedBoards);
  }

  async function handleLoadSave() {
    setShowSaveMenu(false);
    try {
      let defaultPath;
      try { defaultPath = await invoke("get_save_folder"); } catch (_) {}
      const path = await openDialog({ filters: [{ name: "TrackFlow Save", extensions: ["json"] }], multiple: false, defaultPath });
      if (!path) return;
      const text = await invoke("read_file_text", { path: typeof path === "string" ? path : path.path });
      const raw = JSON.parse(text);
      const migrated = migrateState(raw);
      if (!migrated?.pages) { alert("This doesn't look like a valid TrackFlow save file."); return; }
      applyLoadedState(migrated);
      // Also write it as the local save so it persists
      await invoke("save_app_state", { state: JSON.stringify({ ...migrated, updatedAt: Date.now() }) });
    } catch (e) {
      alert("Failed to load save: " + e);
    }
  }

  useEffect(() => {
    loadState().then(raw => {
      applyLoadedState(migrateState(raw));
      setReady(true);
    });
  }, []);

  // ── Reset all state on sign-out; reload state on sign-in ──────────────────
  const prevUserRef = useRef(undefined);
  useEffect(() => {
    // Skip the very first render (undefined = not yet initialized)
    if (prevUserRef.current === undefined) {
      prevUserRef.current = user;
      return;
    }
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    if (prevUser && !user) {
      // Sign-out: wipe every piece of per-user state from memory
      setReady(false);
      setPages(makeDefaultPages());
      setCurrentPageId("producer");
      setProjects([]);
      setWatchedFolders([]);
      setCustomTags(DEFAULT_TAGS);
      setThemePreset("default");
      setThemeCustom(BASE_PRESETS.default);
      setFont("Syne");
      setColMaxHeight(DEFAULT_COL_HEIGHT);
      setCollapsedCols([]);
      setLockedCols([]);
      setSharedBoards([]);
      setSelectedCard(null);
      setActiveTagFilters([]);
      setActiveProjectFilters([]);
      // Overwrite the local save file with a blank slate so the next
      // person who signs in cannot see this user's data, even briefly.
      invoke("save_app_state", { state: JSON.stringify({ schemaVersion: 0, updatedAt: 0 }) }).catch(() => {});
    } else if (!prevUser && user) {
      // New sign-in: load state for this user (cloud-preferred via loadState)
      setReady(false);
      loadState().then(raw => {
        applyLoadedState(migrateState(raw));
        setReady(true);
        const tutorialKey = `tf_tutorial_seen_${user.id}`;
        if (!localStorage.getItem(tutorialKey)) {
          setShowTutorial(true);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  useEffect(() => {
    if (!ready) return;
    async function loadTimes(cols) {
      return Promise.all(cols.map(async col => ({
        ...col,
        cards: await Promise.all(col.cards.map(async card => {
          if (!card.path || card.path.startsWith("~")) return card;
          try { return { ...card, fileModified: await invoke("get_file_modified", { path: card.path }) }; }
          catch (e) { return card; }
        })),
      })));
    }
    async function updateAllPages() {
      const updated = await Promise.all(pagesRef.current.map(async page => ({
        ...page,
        columns: await loadTimes(page.columns),
      })));
      setPages(updated);
    }
    updateAllPages();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    saveState({ pages, currentPageId, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, collapsedCols, lockedCols, sharedBoards });
  }, [ready, pages, currentPageId, projects, watchedFolders, customTags, themePreset, themeCustom, font, colMaxHeight, collapsedCols, lockedCols, sharedBoards]);

  // ── GLOBAL KEYBOARD SHORTCUTS ────────────────────────────────────────────────
  // All mutable state is read through refs so the listener never goes stale.
  const selectedCardRef = useRef(selectedCard);
  useEffect(() => { selectedCardRef.current = selectedCard; }, [selectedCard]);
  const cardClipboardRef = useRef(cardClipboard);
  useEffect(() => { cardClipboardRef.current = cardClipboard; }, [cardClipboard]);

  const pendingScrollCardId = useRef(null);

  // Explicitly scroll both the board (horizontally) and the column (vertically)
  // to center a card. scrollIntoView is unreliable across nested scroll containers.
  function scrollToCard(cardId) {
    const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardEl) return false;

    const board = document.querySelector("[data-board-scroll]");

    // Walk up to find the column's scroll container (CardDropZone: fixed height + overflowY auto)
    let colScroller = null;
    let el = cardEl.parentElement;
    while (el && el !== board) {
      const s = window.getComputedStyle(el);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
        colScroller = el;
        break;
      }
      el = el.parentElement;
    }

    // Scroll board horizontally to center the card's column
    if (board) {
      const boardRect = board.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const targetLeft = board.scrollLeft + (cardRect.left + cardRect.width / 2) - (boardRect.left + boardRect.width / 2);
      board.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }

    // Scroll column vertically to center the card
    if (colScroller) {
      const colRect = colScroller.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const targetTop = colScroller.scrollTop + (cardRect.top + cardRect.height / 2) - (colRect.top + colRect.height / 2);
      colScroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }

    return true;
  }

  // After a page switch, wait for React to commit the new page then scroll.
  useEffect(() => {
    const id = pendingScrollCardId.current;
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      if (scrollToCard(id)) pendingScrollCardId.current = null;
    });
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId, columns]);

  // The handler itself lives in a ref so it always calls the latest functions.
  const kbHandlerRef = useRef(null);
  kbHandlerRef.current = (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "?" && !ctrl) { e.preventDefault(); setShowShortcuts(v => !v); return; }
    if (e.key === "F10") { e.preventDefault(); window.location.reload(); return; }
    const card = selectedCardRef.current;
    if (ctrl && e.key === "r" && card) {
      e.preventDefault();
      askName("Rename Card", card.title, "Card name…").then(name => { if (name) handleRenameCard(card.id, name); });
      return;
    }
    if (ctrl && e.key === "d" && card) {
      e.preventDefault();
      setColumns(cols => cols.map(col => {
        const idx = col.cards.findIndex(c => c.id === card.id);
        if (idx === -1) return col;
        const copy = { ...card, id: Date.now().toString(), title: `${card.title} (copy)` };
        const next = [...col.cards]; next.splice(idx + 1, 0, copy);
        return { ...col, cards: next };
      }));
      return;
    }
    if (ctrl && e.key === "c" && card) { setCardClipboard({ ...card }); return; }
    if (ctrl && e.key === "v") {
      const clip = cardClipboardRef.current; if (!clip) return;
      e.preventDefault();
      setColumns(cols => {
        const target = cols.find(c => c.cards.some(x => x.id === clip.id)) || cols[0];
        if (!target) return cols;
        const paste = { ...clip, id: Date.now().toString(), title: `${clip.title} (copy)` };
        return cols.map(c => c.id === target.id ? { ...c, cards: [...c.cards, paste] } : c);
      });
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && card) {
      if (isViewerRef.current) return;
      e.preventDefault();
      requestConfirm({ title: "Delete card?", message: `Delete "${card.title}"? This cannot be undone.`, confirmLabel: "Delete", onConfirm: () => handleDeleteCard(card.id) });
      return;
    }
  };

  useEffect(() => {
    const onKey = (e) => kbHandlerRef.current?.(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Orphan cleanup
  useEffect(() => {
    const allCardIds = new Set(pages.flatMap(p => p.columns.flatMap(c => c.cards.map(x => x.id))));
    setProjects(ps => {
      const cleaned = ps.map(p => ({ ...p, songs: (p.songs || []).filter(id => allCardIds.has(id)) }));
      return cleaned.some((p, i) => p.songs.length !== ps[i].songs.length) ? cleaned : ps;
    });
  }, [pages]);

  useEffect(() => {
    const onErr = e => { setErrorLog(prev => [...prev, { message: e.message, stack: e.error?.stack, time: Date.now() }]); setShowErrorBar(true); };
    const onRej = e => { setErrorLog(prev => [...prev, { message: String(e.reason), stack: e.reason?.stack, time: Date.now() }]); setShowErrorBar(true); };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);


  async function handleRestartApp() {
    try { await invoke("restart_app"); } catch (_) {
      alert("Please close and reopen TrackFlow to apply the update.");
    }
  }

  useEffect(() => {
    const name = font.replace(/ /g, "+");
    const w = FONT_WEIGHTS[font] || "400;700";
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = `https://fonts.googleapis.com/css2?family=${name}:wght@${w}&display=swap`;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch (e) {} };
  }, [font]);


  const prevUserIdRef = useRef(null);
  useEffect(() => {
    if (!user || !ready) return;
    if (prevUserIdRef.current === user.id) return;
    const isNewSignIn = prevUserIdRef.current === null;
    prevUserIdRef.current = user.id;
    if (!isNewSignIn) return;
    loadState().then(raw => {
      const saved = migrateState(raw);
      if (saved) applyLoadedState(saved);
    });
  }, [user, ready]);

  // Close page context menu on outside click
  useEffect(() => {
    if (!pageContextMenu) return;
    function handleClick() { setPageContextMenu(null); }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [pageContextMenu]);

  // ── DRAG — Pragmatic Drag and Drop monitor ────────────────────────────────
  // Must be here (before early returns) to satisfy Rules of Hooks.
  // Uses refs for all mutable values so the effect only registers once.
  // Reordering is handled via onDragEnter callbacks on individual drop targets.
  useEffect(() => {
    return monitorForElements({
      onDragStart({ source }) {
        if (source.data.type === "card") {
          const col = columnsRef.current.find(c => c.cards.some(x => x.id === source.data.cardId));
          const card = col?.cards.find(c => c.id === source.data.cardId) || null;
          setActiveCard(card);
          dragCardRef.current = card;
          dragStartPageRef.current = currentPageIdRef.current;
          setIsCardDrag(true);
          dragStartColRef.current = source.data.colId;
        } else if (source.data.type === "column") {
          setActiveColId(source.data.colId);
          dragStartPageRef.current = currentPageIdRef.current;
          dragStartRowRef.current = layoutRef.current.findIndex(r => r.includes(String(source.data.colId)));
        }
      },

      onDrop({ source, location }) {
        if (isViewerRef.current) {
          setActiveCard(null); setActiveColId(null); setIsCardDrag(false); dragStartColRef.current = null;
          return;
        }
        const startPageId = dragStartPageRef.current;
        const currentPid = currentPageIdRef.current;
        const isCrossPage = startPageId && startPageId !== currentPid;

        if (source.data.type === "card") {
          const cardId = source.data.cardId;

          const projectTarget = location.current.dropTargets.find(t => t.data.type === "project");
          if (projectTarget) {
            const projId = projectTarget.data.projId;
            const originalColId = dragStartColRef.current;
            setProjects(ps => ps.map(p =>
              p.id !== projId ? p :
              (p.songs || []).includes(cardId) ? p :
              { ...p, songs: [...(p.songs || []), cardId] }
            ));
            setColumns(cols => {
              const currentCol = cols.find(c => c.cards.some(x => x.id === cardId));
              if (!currentCol || !originalColId || currentCol.id === originalColId) return cols;
              const card = currentCol.cards.find(x => x.id === cardId);
              if (!card) return cols;
              return cols.map(c => {
                if (c.id === currentCol.id) return { ...c, cards: c.cards.filter(x => x.id !== cardId) };
                if (c.id === originalColId) return { ...c, cards: [...c.cards, card] };
                return c;
              });
            });
          }

          if (isCrossPage) {
            // Dedup landing page ghost, then ask move vs duplicate
            setColumns(cols => {
              const seen = new Set();
              return cols.map(col => ({ ...col, cards: col.cards.filter(c => seen.has(c.id) ? false : (seen.add(c.id), true)) }));
            });
            const ps = pagesRef.current;
            setCrossPageDrop({
              type: "card",
              itemName: dragCardRef.current?.title || cardId,
              fromPageId: startPageId,
              fromPageName: ps.find(p => p.id === startPageId)?.name || startPageId,
              toPageId: currentPid,
              toPageName: ps.find(p => p.id === currentPid)?.name || currentPid,
              cardId,
              card: dragCardRef.current,
            });
          } else {
            // Same-page drop: just dedup
            setColumns(cols => {
              const seen = new Set();
              return cols.map(col => ({ ...col, cards: col.cards.filter(c => seen.has(c.id) ? false : (seen.add(c.id), true)) }));
            });
          }
        }

        if (source.data.type === "column") {
          if (isCrossPage) {
            const colId = String(source.data.colId);
            const ps = pagesRef.current;
            const col = ps.find(p => p.id === startPageId)?.columns.find(c => String(c.id) === colId);
            setCrossPageDrop({
              type: "column",
              itemName: col?.title || colId,
              fromPageId: startPageId,
              fromPageName: ps.find(p => p.id === startPageId)?.name || startPageId,
              toPageId: currentPid,
              toPageName: ps.find(p => p.id === currentPid)?.name || currentPid,
              colId,
              col,
            });
          }
        }

        setActiveCard(null);
        setActiveColId(null);
        setIsCardDrag(false);
        dragStartColRef.current = null;
        dragStartRowRef.current = null;
        dragStartPageRef.current = null;
        dragCardRef.current = null;
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: uses refs for all mutable values

  // Tab drag visual state — must be before early returns (Rules of Hooks)
  const [tabDragVisual, setTabDragVisual] = useState(null); // { draggingId, fromIdx, slotIdx, ghostX, ghostY, grabOffset, tabWidth }
  const tabBarRef = useRef(null);

  // ── EARLY RETURNS ─────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ height: "100vh", background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Track<span style={{ color: "#c8ff47" }}>Flow</span></div>
    </div>
  );

  if (!user) return (
    <AuthScreenInner signIn={signIn} signUp={signUp} resetPassword={resetPassword} />
  );

  if (!ready) return (
    <div style={{ height: "100vh", background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Syne, sans-serif", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f0" }}>Track<span style={{ color: "#c8ff47" }}>Flow</span></div>
      <div style={{ fontSize: 12, color: "#555" }}>Loading your projects...</div>
    </div>
  );

  // ── LAYOUT HELPERS ────────────────────────────────────────────────────────
  function moveColToRow(colId, targetRowIdx) {
    let newLayout = layout.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
    const clampedIdx = Math.max(0, Math.min(targetRowIdx, newLayout.length));
    if (clampedIdx < newLayout.length) { newLayout[clampedIdx] = [...newLayout[clampedIdx], String(colId)]; }
    else if (newLayout.length < 4) { newLayout.push([String(colId)]); }
    setLayout(newLayout);
  }

  function handleMoveRowUp(colId) {
    if (isEffectiveViewer) return;
    setLayout(current => {
      const rowIdx = current.findIndex(row => row.includes(String(colId)));
      if (rowIdx <= 0) return current;
      const newLayout = current.map(row => row.filter(id => id !== String(colId)));
      newLayout[rowIdx - 1] = [...newLayout[rowIdx - 1], String(colId)];
      return newLayout.filter(row => row.length > 0);
    });
  }

  function handleMoveRowDown(colId) {
    if (isEffectiveViewer) return;
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
    if (isEffectiveViewer) return;
    setLayout(current => {
      if (current.length >= 4) { alert("Maximum 4 rows reached."); return current; }
      const rowIdx = current.findIndex(row => row.includes(String(colId)));
      const wasAlone = rowIdx !== -1 && current[rowIdx].length === 1;
      const newLayout = current.map(row => row.filter(id => id !== String(colId))).filter(row => row.length > 0);
      // Insert immediately below the current row; if column was alone its row
      // disappears so we use rowIdx, otherwise rowIdx+1 to go below the row.
      const insertAt = rowIdx === -1
        ? newLayout.length
        : wasAlone
        ? Math.min(rowIdx, newLayout.length)
        : Math.min(rowIdx + 1, newLayout.length);
      newLayout.splice(insertAt, 0, [String(colId)]);
      return newLayout;
    });
  }

  async function handleAddColToNewRow(afterRowIdx) {
    const title = await askName("New Column", null, "Column name…"); if (!title) return;
    const newId = Date.now().toString();
    setColumns(cols => [...cols, { id: newId, title, color: theme.accent, cards: [] }]);
    setLayout(prev => {
      if (prev.length >= 4) { alert("Maximum 4 rows reached."); return prev; }
      const next = [...prev];
      next.splice(afterRowIdx + 1, 0, [newId]);
      return next;
    });
  }

  // ── DRAG REORDER HANDLERS (called from onDragEnter on drop targets) ────────
  function handleCardOver(draggedId, targetCardId, targetColId) {
    if (isEffectiveViewer) return;
    setColumns(cols => {
      const srcCol = cols.find(c => c.cards.some(x => x.id === draggedId));
      const dstCol = cols.find(c => c.id === targetColId);
      if (!dstCol) return cols;
      if (lockedColsRef.current.includes(dstCol.id)) return cols;

      // Cross-page: card lives in another page, use cached card data
      if (!srcCol) {
        const card = dragCardRef.current;
        if (!card || dragStartPageRef.current === currentPageIdRef.current) return cols;
        const overIdx = dstCol.cards.findIndex(c => c.id === targetCardId);
        return cols.map(c => {
          if (c.id !== dstCol.id) return c;
          const filtered = c.cards.filter(x => x.id !== draggedId);
          filtered.splice(overIdx >= 0 ? overIdx : filtered.length, 0, card);
          return { ...c, cards: filtered };
        });
      }

      if (lockedColsRef.current.includes(srcCol.id)) return cols;
      const card = srcCol.cards.find(c => c.id === draggedId);
      if (!card) return cols;
      if (srcCol.id === dstCol.id) {
        const fromIdx = srcCol.cards.findIndex(c => c.id === draggedId);
        const toIdx = srcCol.cards.findIndex(c => c.id === targetCardId);
        if (fromIdx === toIdx || fromIdx === -1 || toIdx === -1) return cols;
        const nextCards = [...srcCol.cards];
        nextCards.splice(fromIdx, 1);
        nextCards.splice(toIdx, 0, card);
        return cols.map(c => c.id === srcCol.id ? { ...c, cards: nextCards } : c);
      } else {
        const overIdx = dstCol.cards.findIndex(c => c.id === targetCardId);
        return cols.map(c => {
          if (c.id === srcCol.id) return { ...c, cards: c.cards.filter(x => x.id !== draggedId) };
          if (c.id === dstCol.id) {
            const next = [...c.cards];
            next.splice(overIdx >= 0 ? overIdx : next.length, 0, card);
            return { ...c, cards: next };
          }
          return c;
        });
      }
    });
  }

  function handleCardOverZone(draggedId, targetColId) {
    if (isEffectiveViewer) return;
    setColumns(cols => {
      const srcCol = cols.find(c => c.cards.some(x => x.id === draggedId));
      const dstCol = cols.find(c => c.id === targetColId);
      if (!dstCol) return cols;
      if (lockedColsRef.current.includes(dstCol.id)) return cols;

      // Cross-page: card lives in another page
      if (!srcCol) {
        const card = dragCardRef.current;
        if (!card || dragStartPageRef.current === currentPageIdRef.current) return cols;
        if (dstCol.cards.some(x => x.id === draggedId)) return cols; // ghost already here
        return cols.map(c => c.id === dstCol.id ? { ...c, cards: [...c.cards, card] } : c);
      }

      if (srcCol.id === dstCol.id) return cols;
      if (lockedColsRef.current.includes(srcCol.id)) return cols;
      const card = srcCol.cards.find(c => c.id === draggedId);
      if (!card) return cols;
      return cols.map(c => {
        if (c.id === srcCol.id) return { ...c, cards: c.cards.filter(x => x.id !== draggedId) };
        if (c.id === dstCol.id) return { ...c, cards: [...c.cards, card] };
        return c;
      });
    });
  }

  function handleColOver(draggedColId, targetColId) {
    if (isEffectiveViewer) return;
    colFlip.capture();
    const colId = String(draggedColId);
    const targetId = String(targetColId);
    if (colId === targetId) return;
    const lyt = layoutRef.current;
    const activeRow = lyt.findIndex(r => r.includes(colId));
    const overRow = lyt.findIndex(r => r.includes(targetId));
    if (activeRow === -1 || overRow === -1 || activeRow !== overRow) return;
    const row = lyt[activeRow];
    const fi = row.indexOf(colId);
    const ti = row.indexOf(targetId);
    if (fi === ti || fi === -1 || ti === -1) return;
    const newLayout = lyt.map((r, i) => {
      if (i !== activeRow) return r;
      const next = [...r];
      next.splice(fi, 1);
      next.splice(ti, 0, colId);
      return next;
    });
    setLayout(newLayout);
    layoutRef.current = newLayout;
  }

  function handleColOverRow(draggedColId, rowIdx, isNewRow) {
    colFlip.capture();
    const colId = String(draggedColId);
    const lyt = layoutRef.current;
    if (isNewRow) {
      if (lyt.length >= 4) return;
      const newLayout = lyt.map(r => r.filter(id => id !== colId)).filter(r => r.length > 0);
      newLayout.push([colId]);
      setLayout(newLayout);
      layoutRef.current = newLayout;
    } else {
      const currentRow = lyt.findIndex(r => r.includes(colId));
      if (currentRow === rowIdx) return;
      const newLayout = lyt.map(r => r.filter(id => id !== colId)).filter(r => r.length > 0);
      const clamped = Math.max(0, Math.min(rowIdx, newLayout.length));
      if (clamped < newLayout.length) newLayout[clamped] = [...newLayout[clamped], colId];
      else if (newLayout.length < 4) newLayout.push([colId]);
      setLayout(newLayout);
      layoutRef.current = newLayout;
    }
  }

  // ── PAGE MANAGEMENT ───────────────────────────────────────────────────────
  function switchPage(pageId) {
    if (pageId === currentPageId) return;
    setModeTransition(true);
    setTimeout(() => {
      setCurrentPageId(pageId);
      setSelectedCard(null);
      setActiveTagFilters([]);
      setModeTransition(false);
    }, 250);
  }

  // Instant page switch used during drag — no transition, updates refs immediately
  function switchPageForDrag(pageId) {
    if (pageId === currentPageIdRef.current) return;
    setCurrentPageId(pageId);
    currentPageIdRef.current = pageId;
    const newPage = pagesRef.current.find(p => p.id === pageId);
    if (newPage) {
      columnsRef.current = newPage.columns;
      layoutRef.current = newPage.layout;
    }
  }

  // ── CROSS-PAGE DROP HANDLERS ──────────────────────────────────────────────
  function handleCrossPageMove() {
    if (!crossPageDrop) return;
    const { type, cardId, card, colId, col, fromPageId, toPageId } = crossPageDrop;
    if (type === "card") {
      // Remove from origin, dedup already done in landing page
      setPages(ps => ps.map(p => {
        if (p.id !== fromPageId) return p;
        return { ...p, columns: p.columns.map(c => ({ ...c, cards: c.cards.filter(x => x.id !== cardId) })) };
      }));
    } else {
      // Column: atomically transfer
      setPages(ps => {
        const movedCol = ps.find(p => p.id === fromPageId)?.columns.find(c => String(c.id) === colId);
        if (!movedCol) return ps;
        return ps.map(p => {
          if (p.id === fromPageId) return {
            ...p,
            columns: p.columns.filter(c => String(c.id) !== colId),
            layout: p.layout.map(row => row.filter(id => String(id) !== colId)).filter(row => row.length > 0),
          };
          if (p.id === toPageId) {
            const newLayout = p.layout.length > 0
              ? [...p.layout.slice(0, -1), [...p.layout[p.layout.length - 1], colId]]
              : [[colId]];
            return { ...p, columns: [...p.columns, movedCol], layout: newLayout };
          }
          return p;
        });
      });
    }
    setCrossPageDrop(null);
  }

  function handleCrossPageDuplicate() {
    if (!crossPageDrop) return;
    const { type, cardId, card, colId, col, fromPageId, toPageId } = crossPageDrop;
    if (type === "card") {
      // Give the landing-page ghost a new ID so both pages have distinct cards
      const newId = Date.now().toString();
      setPages(ps => ps.map(p => {
        if (p.id !== toPageId) return p;
        return { ...p, columns: p.columns.map(c => ({ ...c, cards: c.cards.map(x => x.id === cardId ? { ...x, id: newId } : x) })) };
      }));
      // Origin page card is untouched
    } else {
      // Duplicate column into landing page with fresh IDs
      if (!col) { setCrossPageDrop(null); return; }
      const newColId = Date.now().toString();
      const dupCol = {
        ...col,
        id: newColId,
        title: col.title + " (copy)",
        cards: col.cards.map(c => ({ ...c, id: c.id + "-" + Date.now() })),
      };
      setPages(ps => ps.map(p => {
        if (p.id !== toPageId) return p;
        const newLayout = p.layout.length > 0
          ? [...p.layout.slice(0, -1), [...p.layout[p.layout.length - 1], newColId]]
          : [[newColId]];
        return { ...p, columns: [...p.columns, dupCol], layout: newLayout };
      }));
      // Origin page column is untouched
    }
    setCrossPageDrop(null);
  }

  function handleCrossPageCancel() {
    if (!crossPageDrop) return;
    const { type, cardId, colId, toPageId } = crossPageDrop;
    if (type === "card") {
      // Remove ghost from landing page — card stays in origin
      setPages(ps => ps.map(p => {
        if (p.id !== toPageId) return p;
        return { ...p, columns: p.columns.map(c => ({ ...c, cards: c.cards.filter(x => x.id !== cardId) })) };
      }));
    }
    // Column drag is atomic — nothing to undo
    setCrossPageDrop(null);
  }

  function handleTabReorder(pageId, slotIdx) {
    setPages(ps => {
      const fromIdx = ps.findIndex(p => p.id === pageId);
      if (fromIdx === -1) return ps;
      const next = [...ps];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(Math.min(slotIdx, next.length), 0, removed);
      return next;
    });
  }

  function handleTabMouseDown(e, pageId) {
    if (e.button !== 0 || e.target.tagName === "INPUT") return;
    e.preventDefault();
    const startX = e.clientX;
    let started = false;

    // Measure tab rects once at drag start
    const container = tabBarRef.current;
    if (!container) return;
    const tabEls = [...container.querySelectorAll("[data-tab-id]")];
    const tabRects = tabEls.map(el => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.tabId, left: r.left, width: r.width, center: r.left + r.width / 2, top: r.top };
    });
    const dragged = tabRects.find(t => t.id === pageId);
    if (!dragged) return;
    const fromIdx = pagesRef.current.findIndex(p => p.id === pageId);
    const grabOffset = e.clientX - dragged.left;

    function getSlotIdx(cursorX) {
      const others = tabRects.filter(t => t.id !== pageId);
      let slot = 0;
      for (let i = 0; i < others.length; i++) {
        if (cursorX > others[i].center) slot = i + 1;
      }
      return slot;
    }

    function onMouseMove(e) {
      if (!started) {
        if (Math.abs(e.clientX - startX) < 4) return;
        started = true;
      }
      setTabDragVisual({
        draggingId: pageId,
        fromIdx,
        slotIdx: getSlotIdx(e.clientX),
        ghostX: e.clientX - grabOffset,
        ghostY: dragged.top,
        grabOffset,
        tabWidth: dragged.width,
      });
    }

    function onMouseUp(e) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (started) {
        const slotIdx = getSlotIdx(e.clientX);
        setTabDragVisual(null);
        if (slotIdx !== fromIdx) handleTabReorder(pageId, slotIdx);
      } else {
        setTabDragVisual(null);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleCreatePage() {
    const palette = ["#b847ff", "#ff6b47", "#3af0b0", "#ff4780", "#c8ff47", "#47c8ff"];
    const usedColors = new Set(pages.map(p => p.color));
    const nextColor = palette.find(c => !usedColors.has(c)) || palette[pages.length % palette.length];
    const newPage = {
      id: Date.now().toString(),
      name: "New Page",
      color: nextColor,
      boardId: crypto.randomUUID(),
      columns: [],
      layout: [],
    };
    setPages(ps => [...ps, newPage]);
    setCurrentPageId(newPage.id);
    setEditingPageId(newPage.id);
  }

  function handleRenamePage(pageId, name) {
    if (!name.trim()) return;
    setPages(ps => ps.map(p => p.id === pageId ? { ...p, name: name.trim() } : p));
  }

  function handleDeletePage(pageId) {
    if (pages.length <= 1) return;
    const remaining = pages.filter(p => p.id !== pageId);
    setPages(remaining);
    if (currentPageId === pageId) setCurrentPageId(remaining[0].id);
  }

  // ── CARD / COLUMN HANDLERS ────────────────────────────────────────────────
  function handleSelectCard(card) { setSelectedCard(card); }

  function handleSongClick(cardId) {
    const targetPage = pages.find(p => p.columns.some(c => c.cards.some(card => card.id === cardId)));
    if (!targetPage) return;
    const card = targetPage.columns.flatMap(c => c.cards).find(c => c.id === cardId);
    if (!card) return;
    setSelectedCard(card);
    if (targetPage.id !== currentPageId) {
      pendingScrollCardId.current = cardId;
      setCurrentPageId(targetPage.id);
    } else {
      requestAnimationFrame(() => scrollToCard(cardId));
    }
  }
  function handleUpdateNote(cardId, note) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, note } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, note } : prev); }
  function handleUpdateTags(cardId, tags) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, tags } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, tags } : prev); }
  async function handleAddCard(colId) { if (isEffectiveViewer) return; const title = await askName("New Card", null, "Project or session name…"); if (!title) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [...col.cards, { id: Date.now().toString(), title, daw: "fl", path: `~/Music/${title}.flp`, tags: [], note: "", date: "Just now" }] } : col)); }
  function handleDeleteCard(cardId) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.filter(c => c.id !== cardId) }))); setSelectedCard(prev => prev?.id === cardId ? null : prev); }
  function handleRenameCard(cardId, title) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.id === cardId ? { ...c, title } : c) }))); setSelectedCard(prev => prev?.id === cardId ? { ...prev, title } : prev); }
  function handleRenameCol(colId, title) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, title } : col)); }
  function handleDeleteCol(colId) {
    if (isEffectiveViewer) return;
    setColumns(cols => cols.filter(col => col.id !== colId));
    setLayout(layoutRef.current.map(row => row.filter(id => id !== colId)).filter(row => row.length > 0));
  }
  function handleDuplicateCol(colId) {
    if (isEffectiveViewer) return;
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
  function handleChangeColColor(colId, color) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, color } : col)); }
  function handleToggleCollapse(colId) { setCollapsedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleToggleLock(colId) { if (isEffectiveViewer) return; setLockedCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]); }
  function handleClearCol(colId) { if (isEffectiveViewer) return; setColumns(cols => cols.map(col => col.id === colId ? { ...col, cards: [] } : col)); }
  async function handleOpenInDaw(filePath) { try { setColumns(cols => cols.map(col => ({ ...col, cards: col.cards.map(c => c.path === filePath ? { ...c, lastOpened: Date.now(), date: "Just opened" } : c) }))); await invoke("open_daw_file", { path: filePath }); } catch (e) { alert("Could not open: " + e); } }
  async function handleAddProject() {
    const title = await askName("New Project", null, "Album, EP, beat tape…");
    if (!title) return;
    const colors = [theme.accent, "#47c8ff", "#ff6b47", "#b847ff", "#3af0b0"];
    setProjects(ps => [...ps, { id: Date.now().toString(), title, color: colors[ps.length % colors.length], songs: [] }]);
  }
  function handleReorderSongs(projId, newSongs) { setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: newSongs } : p)); }
  async function handleAddCol(targetRowIdx) {
    if (isEffectiveViewer) return;
    const title = await askName("New Column", null, "Column name…");
    if (!title) return;
    const newId = Date.now().toString();
    setColumns(cols => [...cols, { id: newId, title, color: theme.accent, cards: [] }]);
    const lyt = layoutRef.current;
    let newLayout;
    if (lyt.length === 0) {
      newLayout = [[newId]];
    } else if (targetRowIdx !== undefined && targetRowIdx >= 0 && targetRowIdx < lyt.length) {
      // Insert into the specific row that was right-clicked
      newLayout = lyt.map((row, i) => i === targetRowIdx ? [...row, newId] : row);
    } else {
      // Default: append to last row
      newLayout = [...lyt.slice(0, -1), [...lyt[lyt.length - 1], newId]];
    }
    setLayout(newLayout);
    layoutRef.current = newLayout;
  }

  // Shows a modal text-input prompt and resolves with the typed string (or null on cancel)
  function askName(title, hint, placeholder) {
    return new Promise(resolve => setNamePrompt({ title, hint, placeholder, resolve }));
  }

  // Async column picker — shows the ColumnPickerModal and resolves with the chosen colId
  function askPickColumn(cols, message) {
    return new Promise(resolve => {
      setColPickerState({ cols, message, resolve });
    });
  }

  async function handleAddFolder() {
    const result = await pickAndScanFolder(); if (!result) return;
    setWatchedFolders(prev => [...new Set([...prev, ...result.folders])]);
    if (result.files.length === 0) { alert("No DAW projects found."); return; }
    const withMeta = await Promise.all(result.files.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    const cols = columnsRef.current;
    if (cols.length === 0) return;
    const targetId = cols.length === 1 ? cols[0].id : await askPickColumn(cols, `Found ${withMeta.length} projects — add into which column?`);
    if (!targetId) return;
    setColumns(prev => {
      const existing = new Set(prev.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      return prev.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }

  async function handleRescan() {
    if (watchedFolders.length === 0) { alert("Add a folder first."); return; }
    const found = await scanForProjects(watchedFolders); if (found.length === 0) { alert("No new projects found."); return; }
    const withMeta = await Promise.all(found.map(async f => { try { return { ...f, fileModified: await invoke("get_file_modified", { path: f.path }) }; } catch (e) { return f; } }));
    const cols = columnsRef.current;
    if (cols.length === 0) return;
    const targetId = cols.length === 1 ? cols[0].id : await askPickColumn(cols, `Rescan found ${found.length} projects — add into which column?`);
    if (!targetId) return;
    setColumns(prev => {
      const existing = new Set(prev.flatMap(c => c.cards.map(x => x.path)));
      const newCards = withMeta.filter(f => !existing.has(f.path));
      return prev.map(col => col.id === targetId ? { ...col, cards: [...col.cards, ...newCards] } : col);
    });
  }

  async function sendErrorReport() {
    const latest = errorLog[errorLog.length - 1];
    const ok = await postToDiscord("🟡 TrackFlow Runtime Error", `**Error:** ${latest?.message || "Unknown"}\n\`\`\`${(latest?.stack || "No stack").substring(0, 1500)}\`\`\``);
    if (ok) { setShowErrorBar(false); setErrorLog([]); } else alert("Send failed.");
  }

  const modeAccent = theme.accent;

  return (
    <div style={{ fontFamily: font || "Syne", background: theme.bg, color: theme.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", transition: "background 0.3s" }}>
      {colPickerState && (
        <ColumnPickerModal
          cols={colPickerState.cols}
          message={colPickerState.message}
          onPick={colId => { colPickerState.resolve(colId); setColPickerState(null); }}
          onCancel={() => { colPickerState.resolve(null); setColPickerState(null); }}
          theme={theme}
        />
      )}
      {namePrompt && (
        <NamePromptModal
          title={namePrompt.title}
          hint={namePrompt.hint}
          placeholder={namePrompt.placeholder}
          onConfirm={name => { namePrompt.resolve(name); setNamePrompt(null); }}
          onCancel={() => { namePrompt.resolve(null); setNamePrompt(null); }}
          theme={theme}
        />
      )}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} theme={theme} />}
      {crossPageDrop && (
        <CrossPageModal
          type={crossPageDrop.type}
          itemName={crossPageDrop.itemName}
          fromPage={crossPageDrop.fromPageName}
          toPage={crossPageDrop.toPageName}
          onMove={handleCrossPageMove}
          onDuplicate={handleCrossPageDuplicate}
          onCancel={handleCrossPageCancel}
          theme={theme}
        />
      )}
      {showProfileModal && user && (
        <ProfileModal
          user={user}
          tier={tier}
          displayName={displayName}
          avatarColor={avatarColor}
          createdAt={createdAt}
          isPaid={isPaid}
          isPremium={isPremium}

          avatarUrl={avatarUrl}
          invitesDisabled={invitesDisabled}
          onUpdateDisplayName={async (name) => { await updateDisplayName(name); }}
          onUpdateAvatarColor={updateAvatarColor}
          onUpdateAvatarUrl={updateAvatarUrl}
          onUpdateInvitesDisabled={updateInvitesDisabled}
          onResetPassword={async () => { await resetPassword(user.email); }}
          onDeleteAccount={async () => {
            const { error } = await deleteAccount();
            if (!error) { await signOut(); }
            else { alert("Delete failed: " + error); }
          }}
          onUpgrade={() => { setShowUpgradeModal(true); setShowProfileModal(false); }}
          onManageBilling={async () => { await openCustomerPortal(); }}
          onClose={() => setShowProfileModal(false)}
          theme={theme}
        />
      )}
      {showShareModal && user && <ShareModal boardId={currentBoardId} boardName={currentPage?.name || "Board"} isShared={isCurrentBoardShared} user={user} members={collabMembers} sentInvites={sentInvites} myRole={myRole} boardLocked={boardLocked} pendingInvites={pendingInvites} onShare={handleShareBoard} onJoin={handleJoinBoard} onLeave={handleLeaveBoard} onDelete={handleStopSharing} onUpdateRole={(userId, role) => updateMemberRole(currentBoardId, userId, role)} onRemoveMember={(userId) => removeMember(currentBoardId, userId)} onAddMember={async (email, role) => { const r = await addMemberByEmail(email, role); fetchSentInvites(); return r; }} onRespondToInvite={handleRespondToInvite} onToggleLock={toggleBoardLock} onClose={() => setShowShareModal(false)} theme={theme} />}
      {showTagManager && <TagManager allTags={customTags} onAddTag={tag => { if (!customTags.find(t => t.label === tag.label)) setCustomTags(p => [...p, tag]); }} onDeleteTag={l => setCustomTags(p => p.filter(t => t.label !== l))} onClose={() => setShowTagManager(false)} theme={theme} />}
      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.confirmLabel}
          destructive
          onConfirm={() => { pendingConfirm.onConfirm(); setPendingConfirm(null); }}
          onCancel={() => setPendingConfirm(null)}
          theme={theme}
        />
      )}
      {showThemeCustomizer && <ThemeCustomizer themeCustom={themeCustom} font={font} onApply={(preset, custom, f) => { setThemePreset(preset); setThemeCustom(custom); setFont(f); setShowThemeCustomizer(false); }} onClose={() => setShowThemeCustomizer(false)} theme={theme} />}
      {showTutorial && <TutorialModal onClose={() => { localStorage.setItem(`tf_tutorial_seen_${user.id}`, "1"); setShowTutorial(false); }} theme={theme} />}
      {showSettings && <SettingsPanel colMaxHeight={colMaxHeight} onSave={(mh) => { setColMaxHeight(mh); setShowSettings(false); }} onClose={() => setShowSettings(false)} onShowShortcuts={() => { setShowSettings(false); setShowShortcuts(true); }} onShowContact={() => { setShowSettings(false); setShowContact(true); }} theme={theme} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} theme={theme} />}
      {showShortcuts && <KeyboardShortcuts theme={theme} onClose={() => setShowShortcuts(false)} />}

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

        {/* Page tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div ref={tabBarRef} data-tutorial="pages" style={{ display: "flex", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: 3, gap: 2, alignItems: "center" }}>
            {pages.map((page, pageIndex) => (
              <PageDragTab
                key={page.id}
                page={page}
                pageIndex={pageIndex}
                isActive={page.id === currentPageId}
                onSwitchForDrag={switchPageForDrag}
                onClick={() => switchPage(page.id)}
                onDoubleClick={() => { switchPage(page.id); setEditingPageId(page.id); }}
                onContextMenu={e => { e.preventDefault(); setPageContextMenu({ pageId: page.id, x: e.clientX, y: e.clientY }); }}
                editingPageId={editingPageId}
                onRename={handleRenamePage}
                onStopEdit={() => setEditingPageId(null)}
                theme={theme}
                font={font}
                isShared={sharedBoards.includes(page.boardId)}
                collabMembers={collabMembers}
                tabDragVisual={tabDragVisual}
                onTabMouseDown={handleTabMouseDown}
              />
            ))}
            {/* Ghost tab following cursor during drag */}
            {tabDragVisual && (() => {
              const gPage = pages.find(p => p.id === tabDragVisual.draggingId);
              if (!gPage) return null;
              const gColor = theme.accent;
              const gIsShared = sharedBoards.includes(gPage.boardId);
              return createPortal(
                <div style={{
                  position: "fixed", pointerEvents: "none", zIndex: 99999,
                  left: tabDragVisual.ghostX, top: tabDragVisual.ghostY,
                  width: tabDragVisual.tabWidth,
                  padding: "4px 10px", borderRadius: theme.r - 2,
                  background: theme.surface3, border: `1px solid ${gColor}`,
                  boxShadow: `0 8px 20px rgba(0,0,0,0.45), 0 0 0 1px ${gColor}33`,
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: font || "Syne", fontSize: 12, fontWeight: 600, color: gColor,
                  userSelect: "none", opacity: 0.95,
                }}>
                  {gIsShared
                    ? <svg width="11" height="9" viewBox="0 0 22 18" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="5" r="4" fill={gColor} />
                        <circle cx="15" cy="5" r="4" fill={gColor} opacity="0.6" />
                        <ellipse cx="7" cy="14" rx="6" ry="4" fill={gColor} />
                        <ellipse cx="15" cy="14" rx="6" ry="4" fill={gColor} opacity="0.6" />
                      </svg>
                    : <div style={{ width: 7, height: 7, borderRadius: "50%", background: gColor, flexShrink: 0 }} />
                  }
                  <span style={{ textShadow: gIsShared ? `0 0 8px ${gColor}` : "none" }}>{gPage.name}</span>
                </div>,
                document.body
              );
            })()}
            {/* "+" new page button */}
            <div
              onClick={handleCreatePage}
              title="New page"
              style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.text3, borderRadius: theme.r - 2, flexShrink: 0, transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = theme.accent}
              onMouseLeave={e => e.currentTarget.style.color = theme.text3}>
              <Icon d={Icons.plus} size={11} />
            </div>
          </div>

          {/* Collaborate/invite button */}
          {user && (
            <button
              onClick={() => isPaid ? setShowShareModal(true) : setShowUpgradeModal(true)}
              data-tutorial="share"
              title={!isPaid ? "Premium feature — upgrade to share boards" : isCurrentBoardShared ? "Board is shared — manage collaboration" : "Invite / share this board"}
              style={{ position: "relative", width: 28, height: 28, borderRadius: theme.r, border: `1px solid ${isCurrentBoardShared ? theme.accent + "60" : theme.border}`, background: isCurrentBoardShared ? `rgba(${theme.accentRgb},0.1)` : "transparent", color: isCurrentBoardShared ? theme.accent : theme.text3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent + "60"; }}
              onMouseLeave={e => { e.currentTarget.style.color = isCurrentBoardShared ? theme.accent : theme.text3; e.currentTarget.style.borderColor = isCurrentBoardShared ? theme.accent + "60" : theme.border; }}>
              <Icon d={Icons.users} size={12} />
              {isCurrentBoardShared && <span style={{ position: "absolute", top: 4, right: 4, width: 5, height: 5, borderRadius: "50%", background: theme.accent }} />}
              {pendingInvites.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, minWidth: 14, height: 14, borderRadius: 7, background: "#ff4d4d", border: `2px solid ${theme.bg || theme.surface}`, fontSize: 8, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>{pendingInvites.length}</span>}
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Expandable search bar */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          {(searchActive || searchQuery) ? (
            <>
              <Icon d={Icons.search} size={12} style={{ position: "absolute", left: 9, color: searchQuery ? theme.accent : theme.text3, pointerEvents: "none" }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQuery) setSearchActive(false); }}
                placeholder="Search projects..."
                style={{ background: theme.surface2, border: `1px solid ${searchQuery ? theme.accent + "60" : theme.border}`, borderRadius: theme.r, padding: "5px 28px 5px 28px", color: theme.text, fontFamily: font || "Syne", fontSize: 12, outline: "none", width: 180, transition: "border-color 0.2s" }}
              />
              {searchQuery && (
                <div onClick={() => { setSearchQuery(""); setSearchActive(false); }} style={{ position: "absolute", right: 8, cursor: "pointer", color: theme.text3, display: "flex" }} onMouseEnter={e => e.currentTarget.style.color = theme.text} onMouseLeave={e => e.currentTarget.style.color = theme.text3}>
                  <Icon d={Icons.close} size={10} />
                </div>
              )}
            </>
          ) : (
            <button onClick={() => setSearchActive(true)} title="Search projects" style={{ width: 32, height: 32, borderRadius: theme.r, border: `1px solid ${theme.border}`, background: theme.surface2, color: theme.text3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = theme.accent} onMouseLeave={e => e.currentTarget.style.color = theme.text3}>
              <Icon d={Icons.search} size={13} />
            </button>
          )}
        </div>

        <SortFilterDropdown sortBy={sortBy} setSortBy={setSortBy} sortDir={sortDir} setSortDir={setSortDir} allTags={customTags} activeTagFilters={activeTagFilters} setActiveTagFilters={setActiveTagFilters} projects={projects} activeProjectFilters={activeProjectFilters} setActiveProjectFilters={setActiveProjectFilters} theme={theme} />

        {watchedFolders.length > 0 && <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{watchedFolders.length} folder{watchedFolders.length > 1 ? "s" : ""} watched</div>}
        {/* Save dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {showSaveMenu && <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setShowSaveMenu(false)} />}
          <button
            onClick={() => setShowSaveMenu(v => !v)}
            title="Save options"
            style={{ width: 32, height: 32, borderRadius: theme.r, border: `1px solid ${showSaveMenu ? theme.accent : theme.border}`, background: theme.surface2, color: showSaveMenu ? theme.accent : theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }}
            onMouseLeave={e => { if (!showSaveMenu) { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border; } }}
          >
            <Icon d={Icons.backup} size={13} />
          </button>
          {showSaveMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 180, zIndex: 9999, overflow: "hidden", fontFamily: font || "Syne" }}>
              {[
                { label: "Backup now", icon: Icons.backup, action: async () => { setShowSaveMenu(false); const p = await backupState(); if (p) alert(`Backup saved:\n${p}`); } },
                { label: "Open save folder", icon: Icons.folder, action: async () => { setShowSaveMenu(false); await invoke("open_save_folder"); } },
                { label: "Load save file…", icon: Icons.scan, action: handleLoadSave },
              ].map((item, i) => (
                <button key={i} onClick={item.action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: "transparent", border: "none", color: theme.text2, cursor: "pointer", fontSize: 12, fontFamily: "inherit", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = theme.surface2; e.currentTarget.style.color = theme.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = theme.text2; }}>
                  <Icon d={item.icon} size={12} style={{ flexShrink: 0 }} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {[
          { icon: Icons.tag, action: () => setShowTagManager(true), hover: "#b847ff", title: "Manage Tags" },
          { icon: Icons.folder, action: handleAddFolder, hover: "#47c8ff", title: "Add Folder" },
          { icon: Icons.scan, action: handleRescan, hover: theme.accent, title: "Rescan" },
          { icon: Icons.settings, action: () => setShowSettings(true), hover: theme.text2, title: "Settings" },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title} style={{ width: 32, height: 32, borderRadius: theme.r, border: `1px solid ${theme.border}`, background: theme.surface2, color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.color = btn.hover} onMouseLeave={e => e.currentTarget.style.color = theme.text2}>
            <Icon d={btn.icon} size={13} />
          </button>
        ))}

        {/* Profile avatar + dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            title={user ? `${displayName || user.email} · ${tier}` : "Click to sign in or create account"}
            onClick={() => { if (user) setShowProfileDropdown(v => !v); }}
            style={{ width: 28, height: 28, borderRadius: "50%", background: user ? `linear-gradient(135deg, ${(AVATAR_GRADIENTS.find(g => g.key === avatarColor) || { a: theme.accent, b: "#47c8ff" }).a}, ${(AVATAR_GRADIENTS.find(g => g.key === avatarColor) || { a: theme.accent, b: "#47c8ff" }).b})` : theme.surface3, border: user ? "none" : `1px solid ${theme.border2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: user ? theme.accentText : theme.text3, cursor: "pointer", overflow: "hidden" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            {user && avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : (displayName ? displayName[0].toUpperCase() : (initial ?? "~"))
            }
          </div>
          {user && !isPaid && (
            <div onClick={() => setShowUpgradeModal(true)} title="Upgrade"
              style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: theme.surface3, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, cursor: "pointer", color: theme.text3 }}>★</div>
          )}
          {user && isPaid && (
            <div title={`${tier} plan`} style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: theme.accent, border: `1px solid ${theme.bg}` }} />
          )}
          {showProfileDropdown && user && (
            <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setShowProfileDropdown(false)} />
          )}
          {showProfileDropdown && user && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 240, zIndex: 9999, overflow: "hidden", fontFamily: font || "Syne" }}>
              {/* Header — avatar + name + email */}
              <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${theme.accent}, #47c8ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: theme.accentText, flexShrink: 0, overflow: "hidden" }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (displayName ? displayName[0].toUpperCase() : (user.email?.[0]?.toUpperCase() ?? "?"))
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingDisplayName ? (
                    <input
                      autoFocus
                      value={displayNameDraft}
                      onChange={e => setDisplayNameDraft(e.target.value)}
                      onBlur={() => { updateDisplayName(displayNameDraft); setEditingDisplayName(false); }}
                      onKeyDown={e => { if (e.key === "Enter") { updateDisplayName(displayNameDraft); setEditingDisplayName(false); } if (e.key === "Escape") setEditingDisplayName(false); e.stopPropagation(); }}
                      placeholder="Display name"
                      style={{ width: "100%", background: theme.surface2, border: `1px solid ${theme.accent}60`, borderRadius: theme.r - 2, padding: "4px 8px", color: theme.text, fontFamily: font || "Syne", fontSize: 13, fontWeight: 800, outline: "none" }}
                    />
                  ) : (
                    <div
                      onClick={() => { setDisplayNameDraft(displayName || ""); setEditingDisplayName(true); }}
                      title="Click to set display name"
                      style={{ fontSize: 16, fontWeight: 800, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>
                      {displayName || <span style={{ color: theme.text3, fontWeight: 400, fontSize: 13 }}>Add display name…</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: theme.text3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      background: isPremium ? `${theme.accent}22` : theme.surface3,
                      color: isPremium ? theme.accent : theme.text3,
                      textTransform: "capitalize",
                    }}>{isPremium ? "Premium" : "Free"}</span>
                    {!isPaid && (
                      <span onClick={() => { setShowUpgradeModal(true); setShowProfileDropdown(false); }} style={{ fontSize: 10, color: theme.accent, cursor: "pointer" }}>Upgrade</span>
                    )}
                  </div>
                </div>
              </div>
              {[
                { label: "Customize Theme", icon: Icons.theme, action: () => { setShowThemeCustomizer(true); setShowProfileDropdown(false); } },
                { label: "Profile Settings", icon: Icons.settings, action: () => { setShowProfileModal(true); setShowProfileDropdown(false); } },
              ].map((item, i) => (
                <div key={i} onClick={item.action}
                  style={{ padding: "10px 16px", cursor: "pointer", fontSize: 12, color: theme.text2, display: "flex", alignItems: "center", gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Icon d={item.icon} size={13} style={{ color: theme.text3 }} />
                  {item.label}
                </div>
              ))}
              <div style={{ height: 1, background: theme.border, margin: "4px 0" }} />
              <div onClick={() => { signOut(); setShowProfileDropdown(false); }}
                style={{ padding: "10px 16px", cursor: "pointer", fontSize: 12, color: "#ff5050", display: "flex", alignItems: "center", gap: 10 }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,80,80,0.08)"; }}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Icon d={Icons.close} size={13} />
                Log Out
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 2, background: `linear-gradient(90deg, ${modeAccent}99, transparent)`, flexShrink: 0 }} />

      {/* Page right-click context menu */}
      {pageContextMenu && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: "fixed", left: pageContextMenu.x, top: pageContextMenu.y, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 160, zIndex: 10001, overflow: "hidden", fontFamily: font || "Syne" }}>
          {[
            { label: "Rename", action: () => { setEditingPageId(pageContextMenu.pageId); switchPage(pageContextMenu.pageId); setPageContextMenu(null); } },
            { label: "Share Board", action: () => { switchPage(pageContextMenu.pageId); setPageContextMenu(null); isPaid ? setShowShareModal(true) : setShowUpgradeModal(true); } },
            { label: "New Page", action: () => { handleCreatePage(); setPageContextMenu(null); } },
            ...(pages.length > 1 ? [{ label: "Delete Page", action: () => { handleDeletePage(pageContextMenu.pageId); setPageContextMenu(null); }, danger: true }] : []),
          ].map((item, i) => (
            <div
              key={i}
              onClick={item.action}
              style={{ padding: "9px 14px", cursor: "pointer", fontSize: 12, color: item.danger ? "#ff5050" : theme.text2 }}
              onMouseEnter={e => e.currentTarget.style.background = theme.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {item.label}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Board blank-space context menu */}
      {boardContextMenu && !isEffectiveViewer && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9997 }} onClick={() => setBoardContextMenu(null)} />
          <div style={{ position: "fixed", left: boardContextMenu.x, top: boardContextMenu.y, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 160, zIndex: 9998, overflow: "hidden", fontFamily: font || "Syne" }}>
            <div onClick={() => { const ri = boardContextMenu?.rowIdx; setBoardContextMenu(null); handleAddCol(ri); }} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 12, color: theme.text2 }} onMouseEnter={e => e.currentTarget.style.background = theme.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              New Column
            </div>
          </div>
        </>,
        document.body
      )}


      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ProjectSidebar
            projects={projects}
            onAddProject={handleAddProject}
            onDeleteProject={id => requestConfirm({ title: "Delete project?", message: "This cannot be undone.", confirmLabel: "Delete", onConfirm: () => setProjects(ps => ps.filter(p => p.id !== id)) })}
            onAddSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: [...(p.songs || []), songId] } : p))}
            onRemoveSong={(projId, songId) => setProjects(ps => ps.map(p => p.id === projId ? { ...p, songs: (p.songs || []).filter(s => s !== songId) } : p))}
            onRenameProject={(id, title) => setProjects(ps => ps.map(p => p.id === id ? { ...p, title } : p))}
            onChangeColor={(id, color) => setProjects(ps => ps.map(p => p.id === id ? { ...p, color } : p))}
            onReorderSongs={handleReorderSongs}
            onRenameCard={handleRenameCard}
            onDeleteCard={id => requestConfirm({ title: "Delete card?", message: "This will permanently remove the card from the board.", confirmLabel: "Delete", onConfirm: () => handleDeleteCard(id) })}
            onSongClick={handleSongClick}
            theme={theme}
            allColumns={pages.flatMap(p => p.columns)}
            isCardDrag={isCardDrag}
            collapsed={projectsCollapsed}
            onToggleCollapsed={() => setProjectsCollapsed(v => !v)}
          />

          <div data-board-scroll onContextMenu={e => { e.preventDefault(); setBoardContextMenu({ x: e.clientX, y: e.clientY }); }} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", opacity: modeTransition ? 0 : 1, transition: "opacity 0.25s, background 0.4s", background: `rgba(${hexToRgbInline(modeAccent)},0.025)` }}>
            {isCurrentBoardShared && boardLocked && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", background: "rgba(255,180,0,0.08)", borderBottom: "1px solid rgba(255,180,0,0.2)", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,180,0,0.9)", fontFamily: theme.font || "Syne" }}>
                  This board is locked — no changes can be made by anyone until the owner unlocks it.
                </span>
              </div>
            )}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16, minWidth: "fit-content" }}>
              {layout.map((rowColIds, rowIdx) => (
                <div key={rowIdx} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setBoardContextMenu({ x: e.clientX, y: e.clientY, rowIdx }); }} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <RowDropZone rowIdx={rowIdx} isGridView={isGridView} isCardDrag={isCardDrag} activeColId={activeColId} theme={theme} onColOverRow={handleColOverRow}>
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      {rowColIds.map(colId => {
                        const col = columns.find(c => c.id === colId);
                        if (!col) return null;
                        return (
                          <DraggableColumn key={col.id} col={col}
                            selectedCard={selectedCard} onSelectCard={handleSelectCard}
                            onAddCard={handleAddCard} onDeleteCard={handleDeleteCard}
                            onOpenInDaw={handleOpenInDaw}
                            onRenameCol={handleRenameCol} onDeleteCol={handleDeleteCol}
                            onDuplicateCol={handleDuplicateCol} onChangeColor={handleChangeColColor}
                            onToggleCollapse={handleToggleCollapse} onToggleLock={handleToggleLock}
                            onClearCol={handleClearCol}
                            onMoveRowUp={handleMoveRowUp} onMoveRowDown={handleMoveRowDown} onMoveToNewRow={handleMoveToNewRow}
                            onRequestConfirm={requestConfirm}
                            allTags={effectiveTags} sortBy={sortBy} sortDir={sortDir}
                            activeFilters={activeTagFilters} activeProjectFilters={activeProjectFilters} allProjects={projects} searchQuery={searchQuery} theme={theme}
                            isCardDrag={isCardDrag}
                            isColDrag={!isCardDrag && activeColId !== null}
                            isCollapsed={collapsedCols.includes(col.id)} isLocked={lockedCols.includes(col.id)} isViewer={isEffectiveViewer}
                            colMaxHeight={colMaxHeight}
                            canMoveUp={isGridView && rowIdx > 0} canMoveDown={isGridView && (layout.length < 4 || rowIdx < layout.length - 1)}
                            onCardOver={handleCardOver}
                            onCardOverZone={handleCardOverZone}
                            onColOver={handleColOver}
                            colFlipRef={colFlip.setRef(col.id)}
                            />
                        );
                      })}
                      {rowIdx === layout.length - 1 && !isEffectiveViewer && (
                        <button onClick={handleAddCol} style={{ flexShrink: 0, width: 46, minHeight: 80, background: "transparent", border: `1px dashed ${theme.border}`, borderRadius: theme.r2, color: theme.text3, opacity: 0.55, cursor: "pointer", alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.15s, border-color 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = 0.9; e.currentTarget.style.borderColor = theme.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.borderColor = theme.border; }}>
                          <Icon d={Icons.plus} size={18} />
                        </button>
                      )}
                    </div>
                  </RowDropZone>
                  {isGridView && layout.length < 4 && !isEffectiveViewer && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", opacity: 0, transition: "opacity 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                      <div style={{ flex: 1, height: 1, background: theme.border }} />
                      <button onClick={() => handleAddColToNewRow(rowIdx)}
                        style={{ flexShrink: 0, padding: "2px 10px", background: "transparent", border: `1px dashed ${theme.border}`, borderRadius: theme.r, color: theme.text3, fontSize: 11, cursor: "pointer", fontFamily: font || "Syne", whiteSpace: "nowrap" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.color = theme.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.text3; }}>
                        + Row
                      </button>
                      <div style={{ flex: 1, height: 1, background: theme.border }} />
                    </div>
                  )}
                </div>
              ))}

              {/* Empty state for pages with no columns */}
              {layout.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 12 }}>
                  <div style={{ fontSize: 13, color: theme.text3 }}>This page is empty</div>
                  {!isEffectiveViewer && (
                    <button onClick={handleAddCol} style={{ padding: "8px 18px", background: `rgba(${theme.accentRgb},0.12)`, border: `1px solid ${theme.accent}40`, borderRadius: theme.r, color: theme.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font || "Syne" }}>
                      + Add Column
                    </button>
                  )}
                </div>
              )}

              {isGridView && layout.length > 0 && layout.length < 4 && (
                <RowDropZone isNewRow hint="Drop a column here to create a new row" isGridView={isGridView} isCardDrag={isCardDrag} activeColId={activeColId} theme={theme} onColOverRow={handleColOverRow} />
              )}
            </div>
          </div>

          <DetailPanel card={selectedCard} onUpdateNote={handleUpdateNote} onUpdateTags={handleUpdateTags} onOpenInDaw={handleOpenInDaw} allTags={effectiveTags} theme={theme} isViewer={isEffectiveViewer} />
        </div>
    </div>
  );
}

export default App;

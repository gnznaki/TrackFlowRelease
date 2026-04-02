import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { draggable, dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { invoke } from "@tauri-apps/api/core";
import { Icon, Icons } from "./Icon";
import ContextMenu from "./ContextMenu";
import { DAW_COLORS, DAW_LABELS } from "../lib/constants";
import { useFlip } from "../hooks/useFlip";

function SongDragPreview({ card, theme }) {
  const dawColor = DAW_COLORS[card.daw] || theme.text3;
  return (
    <div style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, background: theme.surface, border: `1px solid ${theme.accent}55`, borderRadius: theme.r, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", fontFamily: theme.font || "Syne", minWidth: 180, maxWidth: 220 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: dawColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.title}</span>
      <span style={{ fontSize: 9, fontFamily: "monospace", color: dawColor, background: dawColor + "22", padding: "2px 5px", borderRadius: 4 }}>{DAW_LABELS[card.daw]}</span>
    </div>
  );
}

function DraggableSongRow({ songId, card, onRemove, onDragEnter, onRenameCard, onDeleteCard, onSongClick, theme }) {
  const rowRef = useRef(null);
  const handleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(card?.title || "");
  const dataRef = useRef({ card, theme });
  useEffect(() => { dataRef.current = { card, theme }; }, [card, theme]);

  useEffect(() => {
    const el = rowRef.current;
    const handle = handleRef.current;
    if (!el || !handle || !card) return;

    return combine(
      draggable({
        element: el,
        dragHandle: handle,
        getInitialData: () => ({ type: "song", songId }),
        onDragStart() {},
        onDrag() {
          setIsDragging(true);
          el.style.opacity = "0.35";
          el.style.filter = "brightness(1.4)";
          el.style.pointerEvents = "none";
        },
        onDrop() {
          setIsDragging(false);
          el.style.opacity = "";
          el.style.filter = "";
          el.style.pointerEvents = "";
        },
        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            render({ container }) {
              const { card: c, theme: t } = dataRef.current;
              const root = createRoot(container);
              root.render(<SongDragPreview card={c} theme={t} />);
              return () => root.unmount();
            },
          });
        },
      }),
      dropTargetForElements({
        element: el,
        getData: () => ({ type: "song", songId }),
        canDrop: ({ source }) => source.data.type === "song" && source.data.songId !== songId,
        onDragEnter: ({ source }) => {
          setIsOver(true);
          onDragEnter?.(source.data.songId, songId);
        },
        onDragLeave: () => setIsOver(false),
        onDrop: () => setIsOver(false),
      }),
    );
  }, [songId, card]);

  if (!card) return null;
  const dawColor = DAW_COLORS[card.daw] || theme.text3;

  function commitRename() {
    const v = renameVal.trim();
    if (v && v !== card.title) onRenameCard(card.id, v);
    setRenaming(false);
  }

  return (
    <>
      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          theme={theme}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Open Project Folder", icon: Icons.open, action: () => { invoke("open_project_folder", { path: card.path }).catch(console.warn); setContextMenu(null); } },
            { label: "Rename", icon: Icons.tag, action: () => { setRenameVal(card.title); setRenaming(true); setContextMenu(null); } },
            "divider",
            { label: "Remove from Project", icon: Icons.close, action: () => { onRemove(songId); setContextMenu(null); } },
            { label: "Delete Card", icon: Icons.trash, action: () => { onDeleteCard(card.id); onRemove(songId); setContextMenu(null); }, danger: true },
          ]}
        />,
        document.body
      )}
      <div
        ref={rowRef}
        onClick={e => { if (e.detail === 2) return; onSongClick?.(card.id); }}
        onDoubleClick={e => { e.stopPropagation(); setRenameVal(card.title); setRenaming(true); }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        style={{
          padding: "7px 11px 7px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: `1px solid ${theme.border}`,
          borderLeft: `2px solid ${isOver ? theme.accent : "transparent"}`,
          userSelect: "none",
          background: isOver ? theme.accent + "14" : "transparent",
          transition: "background 0.12s, border-color 0.12s",
          cursor: "pointer",
        }}
      >
        {/* Drag handle */}
        <div
          ref={handleRef}
          style={{ color: theme.text3, cursor: "grab", display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.45, transition: "opacity 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
          onMouseLeave={e => e.currentTarget.style.opacity = "0.45"}
        >
          <Icon d={Icons.drag} size={10} />
        </div>
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: dawColor, flexShrink: 0 }} />
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}`, color: theme.text, fontFamily: theme.font || "Syne", fontSize: 11, outline: "none", minWidth: 0 }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 11, color: isOver ? theme.text : theme.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.12s" }}>{card.title}</span>
        )}
        <span style={{ fontSize: 9, fontFamily: "monospace", color: dawColor, flexShrink: 0 }}>{DAW_LABELS[card.daw]}</span>
        <div
          onClick={e => { e.stopPropagation(); onRemove(songId); }}
          style={{ color: theme.text3, cursor: "pointer", display: "flex", flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#ff5050"}
          onMouseLeave={e => e.currentTarget.style.color = theme.text3}
        >
          <Icon d={Icons.close} size={9} />
        </div>
      </div>
    </>
  );
}

export function DroppableProject({ proj, isExpanded, onToggle, onDelete, onRename, onChangeColor, getAllCards, onRemoveSong, onAddSong, onReorderSongs, onRenameCard, onDeleteCard, onSongClick, theme, isCardDrag }) {
  const dropRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(proj.title);
  const [isOver, setIsOver] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [colorPicker, setColorPicker] = useState({ open: false, value: proj.color || theme.accent });
  const colorPickerDragRef = useRef({ dragging: false, ox: 0, oy: 0, x: 120, y: 120 });
  const [colorPickerPos, setColorPickerPos] = useState({ x: 120, y: 120 });
  const songFlip = useFlip();
  // Local optimistic song order for live drag reordering
  const [localSongs, setLocalSongs] = useState(proj.songs || []);

  useEffect(() => {
    setLocalSongs(proj.songs || []);
  }, [proj.songs]);

  useEffect(() => {
    setColorPicker(p => p.open ? p : { ...p, value: proj.color || theme.accent });
  }, [proj.color, theme.accent]);

  useEffect(() => {
    function onMove(e) {
      if (!colorPickerDragRef.current.dragging) return;
      setColorPickerPos({
        x: Math.max(10, Math.min(window.innerWidth - 260, e.clientX - colorPickerDragRef.current.ox)),
        y: Math.max(10, Math.min(window.innerHeight - 180, e.clientY - colorPickerDragRef.current.oy)),
      });
    }
    function onUp() { colorPickerDragRef.current.dragging = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Register project as drop target for board cards
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ type: "project", projId: proj.id }),
      canDrop: ({ source }) => source.data.type === "card",
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [proj.id]);

  function handleSongDragEnter(draggedId, targetId) {
    songFlip.capture();
    setLocalSongs(prev => {
      const from = prev.indexOf(draggedId);
      const to = prev.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }

  // Use a ref so the drop handler always sees the latest localSongs without
  // re-registering the drop target on every reorder (which breaks mid-drag).
  const handleSongDropRef = useRef(null);
  handleSongDropRef.current = () => onReorderSongs(proj.id, localSongs);

  // Listen for when any song drag ends to commit the order
  useEffect(() => {
    if (!isExpanded) return;
    const el = dropRef.current;
    if (!el) return;

    // We use a drop target on the whole project body to catch song drops
    return dropTargetForElements({
      element: el,
      getData: () => ({ type: "song-list", projId: proj.id }),
      canDrop: ({ source }) => source.data.type === "song",
      onDrop: () => handleSongDropRef.current?.(),
    });
  }, [isExpanded, proj.id]);

  const contextItems = [
    { label: "Rename", icon: Icons.tag, action: () => setEditing(true) },
    { label: "Change Color", icon: Icons.theme, action: () => setColorPicker(p => ({ ...p, open: true })) },
    "divider",
    { label: "Delete Project", icon: Icons.trash, action: () => onDelete(proj.id), danger: true },
  ];

  return (
    <div
      ref={dropRef}
      style={{
        marginBottom: 4,
        borderRadius: theme.r,
        border: `1px solid ${isOver ? theme.accent : isExpanded ? theme.accent + "40" : theme.border}`,
        background: isOver ? theme.accent + "12" : isExpanded ? theme.surface2 : "transparent",
        transition: "all 0.15s",
        overflow: "hidden",
      }}
    >
      {contextMenu && createPortal(
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItems} onClose={() => setContextMenu(null)} theme={theme} />,
        document.body
      )}
      {colorPicker.open && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10000 }} onMouseDown={() => setColorPicker(p => ({ ...p, open: false }))}>
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{ position: "fixed", left: colorPickerPos.x, top: colorPickerPos.y, width: 250, background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2 || 12, boxShadow: "0 18px 60px rgba(0,0,0,0.55)", overflow: "hidden", fontFamily: theme.font || "Syne" }}
          >
            <div
              onMouseDown={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                colorPickerDragRef.current = { dragging: true, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
                e.preventDefault(); e.stopPropagation();
              }}
              style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "move", userSelect: "none", color: theme.text, fontWeight: 700, fontSize: 12 }}
            >
              Project color
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { onChangeColor(proj.id, colorPicker.value); setColorPicker(p => ({ ...p, open: false })); }} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: theme.accent, color: theme.accentText, cursor: "pointer", fontWeight: 800, fontSize: 12 }}>✓</button>
                <button onClick={() => setColorPicker(p => ({ ...p, open: false }))} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${theme.border2}`, background: theme.surface2, color: theme.text2, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Cancel</button>
              </div>
            </div>
            <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <input type="color" value={colorPicker.value} onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))} style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: "pointer" }} />
              <input value={colorPicker.value} onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))} style={{ flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 10px", color: theme.text, fontFamily: "monospace", fontSize: 12, outline: "none" }} />
            </div>
          </div>
        </div>,
        document.body
      )}
      <div
        style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
        onClick={() => onToggle(proj.id)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
      >
        <div style={{ width: 8, height: 8, borderRadius: 2, background: proj.color || theme.accent, flexShrink: 0 }} />
        {editing ? (
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onBlur={() => { onRename(proj.id, val); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") { onRename(proj.id, val); setEditing(false); } e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}`, color: theme.text, fontFamily: theme.font || "Syne", fontSize: 12, fontWeight: 600, outline: "none" }} />
        ) : (
          <span onDoubleClick={e => { e.stopPropagation(); setEditing(true); }} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: isOver ? theme.accent : theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.title}</span>
        )}
        {isOver && <Icon d={Icons.drop} size={11} style={{ color: theme.accent, flexShrink: 0 }} />}
        <span style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace" }}>{localSongs.length}</span>
        <Icon d={isExpanded ? Icons.chevronUp : Icons.chevronDown} size={10} style={{ color: theme.text3 }} />
      </div>
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${theme.border}` }}>
          {localSongs.map(songId => {
            const allCards = getAllCards();
            const card = allCards.find(c => c.id === songId);
            return (
              <div key={songId} ref={songFlip.setRef(songId)} style={{ position: "relative" }}>
                <DraggableSongRow
                  songId={songId}
                  card={card}
                  onRemove={id => onRemoveSong(proj.id, id)}
                  onDragEnter={handleSongDragEnter}
                  onRenameCard={onRenameCard}
                  onDeleteCard={onDeleteCard}
                  onSongClick={onSongClick}
                  theme={theme}
                />
              </div>
            );
          })}
          <div style={{ padding: "7px 11px" }}>
            <select defaultValue="" onChange={e => { if (e.target.value) { onAddSong(proj.id, e.target.value); e.target.value = ""; } }} style={{ width: "100%", background: theme.surface3, border: `1px solid ${theme.border}`, borderRadius: theme.r - 2, color: theme.text2, fontFamily: theme.font || "Syne", fontSize: 11, padding: "4px 7px", outline: "none", cursor: "pointer" }}>
              <option value="" disabled>+ Add song...</option>
              {getAllCards().filter(c => !localSongs.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectSidebar({ projects, onAddProject, onDeleteProject, onAddSong, onRemoveSong, onRenameProject, onChangeColor, onReorderSongs, onRenameCard, onDeleteCard, onSongClick, theme, allColumns, isCardDrag, collapsed, onToggleCollapsed }) {
  const [expandedId, setExpandedId] = useState(null);
  const getAllCards = useCallback(() => allColumns.flatMap(col => col.cards), [allColumns]);
  const [areaContextMenu, setAreaContextMenu] = useState(null);

  // ── SONG DRAG AUTO-SCROLL ─────────────────────────────────────────────────
  // `dragover` on document is the only event that reliably fires during a native
  // HTML5 drag (pointermove and onDrag callbacks are suppressed by the browser).
  // Vertical: sidebar list scrolled via direct ref.
  // Horizontal: main board found via [data-board-scroll] attribute (DOM-walk can't
  // reach it from sidebar elements since the board is a sibling, not an ancestor).
  const [isSongDrag, setIsSongDrag] = useState(false);
  const songDragPointer = useRef({ x: 0, y: 0 });
  const songScrollRaf = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source }) => { if (source.data.type === "song") setIsSongDrag(true); },
      onDrop:      ({ source }) => { if (source.data.type === "song") setIsSongDrag(false); },
    });
  }, []);

  useEffect(() => {
    if (!isSongDrag) {
      if (songScrollRaf.current) { cancelAnimationFrame(songScrollRaf.current); songScrollRaf.current = null; }
      return;
    }

    function onDragOver(e) { songDragPointer.current = { x: e.clientX, y: e.clientY }; }
    document.addEventListener("dragover", onDragOver, { capture: true, passive: true });

    const ZONE = 80;

    function loop() {
      const { x, y } = songDragPointer.current;

      // Vertical: scroll sidebar list
      const sc = scrollRef.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (y < r.top + ZONE) {
          sc.scrollTop -= Math.round(8 * (1 - Math.max(0, y - r.top) / ZONE));
        } else if (y > r.bottom - ZONE) {
          sc.scrollTop += Math.round(8 * (1 - Math.max(0, r.bottom - y) / ZONE));
        }
      }

      // Horizontal: scroll main board
      const board = document.querySelector("[data-board-scroll]");
      if (board) {
        const r = board.getBoundingClientRect();
        if (x > r.right - ZONE) {
          board.scrollLeft += Math.round(8 * (1 - Math.max(0, r.right - x) / ZONE));
        } else if (x < r.left + ZONE) {
          board.scrollLeft -= Math.round(8 * (1 - Math.max(0, x - r.left) / ZONE));
        }
      }

      songScrollRaf.current = requestAnimationFrame(loop);
    }
    songScrollRaf.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("dragover", onDragOver, { capture: true });
      if (songScrollRaf.current) { cancelAnimationFrame(songScrollRaf.current); songScrollRaf.current = null; }
    };
  }, [isSongDrag]);

  return (
    <div style={{ width: collapsed ? 52 : 235, flexShrink: 0, borderRight: `1px solid ${theme.border}`, background: theme.surface, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.18s" }}>
      <div
        onContextMenu={collapsed ? undefined : e => { e.preventDefault(); setAreaContextMenu({ x: e.clientX, y: e.clientY }); }}
        style={{ padding: collapsed ? "12px 10px" : "13px 14px 10px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: collapsed ? "center" : "center", justifyContent: "space-between", gap: 8, flexDirection: collapsed ? "column" : "row" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: collapsed ? "center" : "flex-start" }}>
          <Icon d={Icons.album} size={13} style={{ color: theme.accent }} />
          {!collapsed && <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Projects</span>}
        </div>
        {collapsed ? (
          <button
            onClick={onToggleCollapsed}
            title="Expand Projects"
            style={{ width: 26, height: 18, borderRadius: 999, border: `1px solid ${theme.border2}`, background: theme.surface2, color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
            <Icon d={Icons.chevronDown} size={11} />
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onAddProject} style={{ width: 22, height: 22, borderRadius: theme.r - 2, border: `1px solid ${theme.border2}`, background: "transparent", color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }} onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
              <Icon d={Icons.plus} size={11} />
            </button>
            <button onClick={onToggleCollapsed} title="Collapse Projects"
              style={{ width: 22, height: 22, borderRadius: theme.r - 2, border: `1px solid ${theme.border2}`, background: "transparent", color: theme.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.borderColor = theme.accent; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.text2; e.currentTarget.style.borderColor = theme.border2; }}>
              <Icon d={Icons.chevronUp} size={11} />
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <>
          {isCardDrag && projects.length > 0 && <div style={{ padding: "5px 10px", background: theme.accent + "18", borderBottom: `1px solid ${theme.border}`, fontSize: 10, color: theme.accent, fontFamily: "monospace", textAlign: "center" }}>Drop onto a project to add it</div>}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: "auto", padding: "8px" }}
            onContextMenu={e => { e.preventDefault(); setAreaContextMenu({ x: e.clientX, y: e.clientY }); }}
          >
            {areaContextMenu && createPortal(
              <ContextMenu
                x={areaContextMenu.x}
                y={areaContextMenu.y}
                items={[{ label: "New Project", icon: Icons.plus, action: () => { setAreaContextMenu(null); onAddProject(); } }]}
                onClose={() => setAreaContextMenu(null)}
                theme={theme}
              />,
              document.body
            )}
            {projects.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: theme.text3, fontSize: 12, lineHeight: 1.7 }}>Create projects to organize songs into albums, beat tapes, or EPs.</div>}
            {projects.map(proj => (
              <DroppableProject
                key={proj.id}
                proj={proj}
                isExpanded={expandedId === proj.id}
                onToggle={id => setExpandedId(expandedId === id ? null : id)}
                onDelete={onDeleteProject}
                onRename={onRenameProject}
                onChangeColor={onChangeColor}
                getAllCards={getAllCards}
                onRemoveSong={onRemoveSong}
                onAddSong={onAddSong}
                onReorderSongs={onReorderSongs}
                onRenameCard={onRenameCard}
                onDeleteCard={onDeleteCard}
                onSongClick={onSongClick}
                theme={theme}
                isCardDrag={isCardDrag}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

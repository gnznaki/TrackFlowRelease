import { useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon, Icons } from "./Icon";
import { DAW_COLORS, DAW_LABELS } from "../lib/constants";

function SortableSongRow({ songId, card, onRemove, theme }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: songId });
  if (!card) return null;
  const dawColor = DAW_COLORS[card.daw] || theme.text3;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        padding: "7px 11px 7px 26px",
        display: "flex",
        alignItems: "center",
        gap: 7,
        borderBottom: `1px solid ${theme.border}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        userSelect: "none",
        background: isDragging ? theme.surface3 : "transparent",
      }}
    >
      <div style={{ width: 3, height: 3, borderRadius: "50%", background: dawColor, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 11, color: theme.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.title}</span>
      <span style={{ fontSize: 9, fontFamily: "monospace", color: dawColor }}>{DAW_LABELS[card.daw]}</span>
      <div
        onClick={e => { e.stopPropagation(); onRemove(songId); }}
        style={{ color: theme.text3, cursor: "pointer", display: "flex" }}
        onMouseEnter={e => e.currentTarget.style.color = "#ff5050"}
        onMouseLeave={e => e.currentTarget.style.color = theme.text3}
      >
        <Icon d={Icons.close} size={9} />
      </div>
    </div>
  );
}

export function DroppableProject({ proj, isExpanded, onToggle, onDelete, onRename, getAllCards, onRemoveSong, onAddSong, onReorderSongs, theme, isCardDrag }) {
  const { setNodeRef, isOver } = useDroppable({ id: "proj-" + proj.id, disabled: !isCardDrag });
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(proj.title);
  const [activeSongId, setActiveSongId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const songs = proj.songs || [];
  const allCards = getAllCards();
  const activeCard = activeSongId ? allCards.find(c => c.id === activeSongId) : null;

  function handleSongDragEnd({ active, over }) {
    setActiveSongId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = songs.indexOf(active.id);
    const newIdx = songs.indexOf(over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorderSongs(proj.id, arrayMove(songs, oldIdx, newIdx));
  }

  return (
    <div ref={setNodeRef} style={{ marginBottom: 4, borderRadius: theme.r, border: `1px solid ${isOver ? theme.accent : isExpanded ? theme.accent + "40" : theme.border}`, background: isOver ? theme.accent + "12" : isExpanded ? theme.surface2 : "transparent", transition: "all 0.15s", overflow: "hidden" }}>
      <div style={{ padding: "9px 11px", display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }} onClick={() => onToggle(proj.id)}>
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
        <span style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace" }}>{songs.length}</span>
        <Icon d={isExpanded ? Icons.chevronUp : Icons.chevronDown} size={10} style={{ color: theme.text3 }} />
        <div onClick={e => { e.stopPropagation(); if (window.confirm(`Delete "${proj.title}"?`)) onDelete(proj.id); }} style={{ color: theme.text3, display: "flex", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.color = "#ff5050"} onMouseLeave={e => e.currentTarget.style.color = theme.text3}><Icon d={Icons.close} size={10} /></div>
      </div>
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${theme.border}` }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => setActiveSongId(active.id)}
            onDragEnd={handleSongDragEnd}
            onDragCancel={() => setActiveSongId(null)}
          >
            <SortableContext items={songs} strategy={verticalListSortingStrategy}>
              {songs.map(songId => {
                const card = allCards.find(c => c.id === songId);
                return (
                  <SortableSongRow
                    key={songId}
                    songId={songId}
                    card={card}
                    onRemove={id => onRemoveSong(proj.id, id)}
                    theme={theme}
                  />
                );
              })}
            </SortableContext>
            <DragOverlay>
              {activeCard && (
                <div style={{ padding: "7px 11px 7px 26px", display: "flex", alignItems: "center", gap: 7, background: theme.surface3, borderRadius: theme.r, opacity: 0.9, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                  <div style={{ width: 3, height: 3, borderRadius: "50%", background: DAW_COLORS[activeCard.daw] || theme.text3, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: theme.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeCard.title}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
          <div style={{ padding: "7px 11px" }}>
            <select defaultValue="" onChange={e => { if (e.target.value) { onAddSong(proj.id, e.target.value); e.target.value = ""; } }} style={{ width: "100%", background: theme.surface3, border: `1px solid ${theme.border}`, borderRadius: theme.r - 2, color: theme.text2, fontFamily: theme.font || "Syne", fontSize: 11, padding: "4px 7px", outline: "none", cursor: "pointer" }}>
              <option value="" disabled>+ Add song...</option>
              {getAllCards().filter(c => !songs.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectSidebar({ projects, onAddProject, onDeleteProject, onAddSong, onRemoveSong, onRenameProject, onReorderSongs, theme, allColumns, isCardDrag, collapsed, onToggleCollapsed }) {
  const [expandedId, setExpandedId] = useState(null);
  const getAllCards = useCallback(() => allColumns.flatMap(col => col.cards), [allColumns]);
  return (
    <div style={{ width: collapsed ? 52 : 235, flexShrink: 0, borderRight: `1px solid ${theme.border}`, background: theme.surface, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.18s" }}>
      <div style={{ padding: collapsed ? "12px 10px" : "13px 14px 10px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: collapsed ? "center" : "center", justifyContent: "space-between", gap: 8, flexDirection: collapsed ? "column" : "row" }}>
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
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {projects.length === 0 && <div style={{ padding: "18px 10px", textAlign: "center", color: theme.text3, fontSize: 12, lineHeight: 1.7 }}>Create projects to organize songs into albums, beat tapes, or EPs.</div>}
            {projects.map(proj => (
              <DroppableProject
                key={proj.id}
                proj={proj}
                isExpanded={expandedId === proj.id}
                onToggle={id => setExpandedId(expandedId === id ? null : id)}
                onDelete={onDeleteProject}
                onRename={onRenameProject}
                getAllCards={getAllCards}
                onRemoveSong={onRemoveSong}
                onAddSong={onAddSong}
                onReorderSongs={onReorderSongs}
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

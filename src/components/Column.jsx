import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Icon, Icons } from "./Icon";
import Tag from "./Tag";
import ContextMenu from "./ContextMenu";
import { DAW_COLORS, DAW_LABELS } from "../lib/constants";

export function CardContent({ card, isSelected, onDelete, isDragging, allTags, theme }) {
  const [hovered, setHovered] = useState(false);
  const dawColor = DAW_COLORS[card.daw] || theme.text2;

  const cardBorderColor = isSelected ? theme.accent + "99" : theme.border2;
  const hoverShadow = hovered && !isDragging
    ? `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${theme.border2}`
    : "none";
  const selectedShadow = isSelected ? `0 0 0 2px ${theme.accent}40` : "none";
  const cardShadow = isDragging
    ? "0 12px 40px rgba(0,0,0,0.5)"
    : isSelected
    ? selectedShadow
    : hoverShadow;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: `linear-gradient(135deg, ${theme.surface2}, ${theme.surface2}dd)`,
        border: `1px solid ${cardBorderColor}`,
        borderRadius: theme.r,
        padding: "12px 13px",
        borderLeft: `3px solid ${dawColor}`,
        opacity: isDragging ? 0.9 : 1,
        boxShadow: cardShadow,
        position: "relative",
        transition: "box-shadow 0.2s, transform 0.15s",
        transform: hovered && !isDragging ? "translateY(-1px)" : "none",
      }}
    >
      {/* DAW badge — absolute top-right */}
      <div style={{ position: "absolute", top: 9, right: onDelete ? 30 : 9 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 6px", borderRadius: 6, background: dawColor + "22", color: dawColor, fontFamily: "monospace", letterSpacing: "0.03em" }}>
          {DAW_LABELS[card.daw] || "?"}
        </span>
      </div>

      {onDelete && (
        <div
          onClick={e => { e.stopPropagation(); onDelete(card.id); }}
          style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: theme.text3 }}
          onMouseEnter={e => e.currentTarget.style.color = "#ff5050"}
          onMouseLeave={e => e.currentTarget.style.color = theme.text3}
        >
          <Icon d={Icons.close} size={11} />
        </div>
      )}

      {/* Title row — leave room for badge */}
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, lineHeight: 1.3, paddingRight: 52, marginBottom: 5 }}>
        {card.title}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 10, color: theme.text3, opacity: 0.7, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {card.path}
      </div>

      <div style={{ flexWrap: "wrap", display: "flex", marginBottom: card.note ? 7 : 0 }}>
        {(card.tags || []).map(t => {
          const td = allTags?.find(x => x.label === t);
          return <Tag key={t} label={t} color={td?.color} theme={theme} style={{ borderRadius: 10 }} />;
        })}
      </div>

      {card.note && (
        <div style={{ fontSize: 11, color: theme.text2, background: theme.surface3, borderRadius: theme.r - 2, padding: "5px 8px", borderLeft: `2px solid ${theme.border2}`, marginBottom: 7 }}>
          {card.note}
        </div>
      )}

      <div style={{ fontSize: 10, fontFamily: "monospace", color: theme.text3, borderTop: `1px solid ${theme.border}`, marginTop: 6, paddingTop: 6 }}>
        {card.date}
      </div>
    </div>
  );
}

function SortableCard({ card, isSelected, onClick, onDelete, onOpenInDaw, allTags, theme, isLocked }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card" },
    disabled: isLocked,
    transition: {
      duration: 180,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });
  const [cardMenu, setCardMenu] = useState(null);

  const cardMenuItems = [
    ...(card.path && !card.path.startsWith("~") ? [
      { label: "Open in DAW", icon: Icons.folder, action: () => onOpenInDaw?.(card.path) },
      { label: "Copy Path", icon: Icons.copy, action: () => navigator.clipboard?.writeText(card.path) },
      "divider",
    ] : []),
    { label: "Delete Card", icon: Icons.trash, action: () => onDelete?.(card.id), danger: true },
  ];

  return (
    <div
      ref={setNodeRef}
      {...(isLocked ? {} : listeners)}
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCardMenu({ x: e.clientX, y: e.clientY }); }}
      style={{ transform: CSS.Transform.toString(transform), transition, marginBottom: 8, opacity: isDragging ? 0 : 1, cursor: isLocked ? "default" : (isDragging ? "grabbing" : "grab"), touchAction: "none", userSelect: "none" }}>
      {cardMenu && createPortal(
        <ContextMenu x={cardMenu.x} y={cardMenu.y} items={cardMenuItems} onClose={() => setCardMenu(null)} theme={theme} />,
        document.body
      )}
      <CardContent card={card} isSelected={isSelected} onDelete={onDelete} allTags={allTags} theme={theme} />
    </div>
  );
}

function CardDropZone({ colId, children, theme, isCardDrag, colMaxHeight, isEmpty, hasActiveFilters }) {
  const { setNodeRef, isOver } = useDroppable({ id: "zone-" + colId, disabled: !isCardDrag });
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: 12,
        height: colMaxHeight,
        overflowY: "auto",
        background: isOver && isCardDrag
          ? `rgba(${theme.accentRgb},0.1)`
          : "transparent",
        border: isOver && isCardDrag
          ? `1px dashed ${theme.accent}40`
          : "1px solid transparent",
        borderRadius: theme.r,
        transition: "background 0.15s, border 0.15s",
      }}>
      {children}
      {isEmpty && !hasActiveFilters && (
        <div style={{ textAlign: "center", padding: "20px 0", color: theme.text3, fontSize: 11, letterSpacing: "0.03em", userSelect: "none" }}>
          Drop projects here
        </div>
      )}
    </div>
  );
}

export function SortableColumn({ col, selectedCard, onSelectCard, onAddCard, onDeleteCard, onOpenInDaw, onRenameCol, onDeleteCol, onDuplicateCol, onChangeColor, onToggleCollapse, onToggleLock, onClearCol, onMoveRowUp, onMoveRowDown, onMoveToNewRow, allTags, sortBy, sortDir, activeFilters, searchQuery, theme, isCardDrag, isCollapsed, isLocked, colMaxHeight, canMoveUp, canMoveDown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
    data: { type: "column" },
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    }
  });
  const [contextMenu, setContextMenu] = useState(null);
  const [colorPicker, setColorPicker] = useState({ open: false, value: col.color, x: 120, y: 120 });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(col.title);
  const dragRef = useRef({ dragging: false, ox: 0, oy: 0 });

  useEffect(() => { setTitleVal(col.title); }, [col.title]);

  useEffect(() => {
    setColorPicker(p => (p.open ? p : { ...p, value: col.color }));
  }, [col.color]);

  function openColorPicker() {
    setColorPicker(p => ({ ...p, open: true, value: col.color }));
  }

  function closeColorPicker() {
    setColorPicker(p => ({ ...p, open: false }));
  }

  function applyColorPicker() {
    onChangeColor(col.id, colorPicker.value);
    closeColorPicker();
  }

  function onPickerMouseDown(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { dragging: true, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    e.preventDefault();
    e.stopPropagation();
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.dragging) return;
      setColorPicker(p => ({
        ...p,
        x: Math.max(10, Math.min(window.innerWidth - 260, e.clientX - dragRef.current.ox)),
        y: Math.max(10, Math.min(window.innerHeight - 180, e.clientY - dragRef.current.oy)),
      }));
    }
    function onUp() { dragRef.current.dragging = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const sortedCards = [...col.cards]
    .filter(card => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hit = card.title.toLowerCase().includes(q)
          || (card.path || "").toLowerCase().includes(q)
          || (card.note || "").toLowerCase().includes(q)
          || (card.tags || []).some(t => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return activeFilters.length === 0 || activeFilters.every(f => (card.tags || []).includes(f));
    })
    .sort((a, b) => {
      if (sortBy === "modified") return sortDir === "asc" ? (a.fileModified || 0) - (b.fileModified || 0) : (b.fileModified || 0) - (a.fileModified || 0);
      if (sortBy === "opened") return sortDir === "asc" ? (a.lastOpened || 0) - (b.lastOpened || 0) : (b.lastOpened || 0) - (a.lastOpened || 0);
      return 0;
    });

  const contextItems = [
    { label: "Rename", icon: Icons.tag, action: () => { setEditingTitle(true); } },
    { label: isCollapsed ? "Expand" : "Collapse", icon: Icons.collapse, action: () => onToggleCollapse(col.id) },
    { label: isLocked ? "Unlock Column" : "Lock Column", icon: isLocked ? Icons.unlock : Icons.lock, action: () => onToggleLock(col.id) },
    "divider",
    { label: "Change Color", icon: Icons.theme, keepOpen: true, action: () => openColorPicker() },
    { label: "Duplicate Column", icon: Icons.copy, action: () => onDuplicateCol(col.id) },
    "divider",
    ...(canMoveUp ? [{ label: "Move to Row Above", icon: Icons.rowUp, action: () => onMoveRowUp(col.id) }] : []),
    ...(canMoveDown ? [{ label: "Move to Row Below", icon: Icons.rowDown, action: () => onMoveRowDown(col.id) }] : []),
    { label: "Move to New Row", icon: Icons.rowDown, action: () => onMoveToNewRow(col.id) },
    "divider",
    { label: "Clear All Cards", icon: Icons.trash, action: () => { if (window.confirm(`Clear all cards from "${col.title}"?`)) onClearCol(col.id); }, danger: true },
    { label: "Delete Column", icon: Icons.close, action: () => { if (window.confirm(`Delete "${col.title}"?`)) onDeleteCol(col.id); }, danger: true },
  ];

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, width: 285, flexShrink: 0, willChange: "transform" }}>
      {contextMenu && createPortal(<ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItems} onClose={() => setContextMenu(null)} theme={theme} />, document.body)}
      {colorPicker.open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000 }} onMouseDown={closeColorPicker}>
          <div
            onMouseDown={e => { e.stopPropagation(); }}
            style={{
              position: "fixed",
              left: colorPicker.x,
              top: colorPicker.y,
              width: 250,
              background: theme.surface,
              border: `1px solid ${theme.border2}`,
              borderRadius: theme.r2,
              boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
              overflow: "hidden",
              fontFamily: theme.font || "Syne",
            }}
          >
            <div
              onMouseDown={onPickerMouseDown}
              style={{
                padding: "10px 12px",
                borderBottom: `1px solid ${theme.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "move",
                userSelect: "none",
                color: theme.text,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Column color
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={applyColorPicker} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: theme.accent, color: theme.accentText, cursor: "pointer", fontWeight: 800, fontSize: 12 }}>✓</button>
                <button onClick={closeColorPicker} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${theme.border2}`, background: theme.surface2, color: theme.text2, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Cancel</button>
              </div>
            </div>
            <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <input type="color" value={colorPicker.value} onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))} style={{ width: 44, height: 44, border: "none", background: "transparent", cursor: "pointer" }} />
              <input
                value={colorPicker.value}
                onChange={e => setColorPicker(p => ({ ...p, value: e.target.value }))}
                style={{ flex: 1, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 10px", color: theme.text, fontFamily: "monospace", fontSize: 12, outline: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        style={{
          background: theme.surface,
          border: `1px solid ${isDragging ? theme.accent + "60" : isLocked ? theme.accent + "30" : theme.border}`,
          borderRadius: theme.r2,
          overflow: "hidden",
          opacity: isDragging ? 0 : 1,
        }}
      >
        {/* HEADER */}
        <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 7, borderBottom: isCollapsed ? "none" : `1px solid ${theme.border}` }}>
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: col.color + "80", display: "flex", alignItems: "center", flexShrink: 0, touchAction: "none" }}
          >
            <Icon d={Icons.drag} size={14} />
          </div>

          {/* Color dot */}
          <div
            onClick={() => openColorPicker()}
            style={{ width: 12, height: 12, borderRadius: "50%", background: col.color, flexShrink: 0, cursor: "pointer", transition: "box-shadow 0.15s" }}
            title="Click to change color"
            onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 0 3px ${col.color}55`}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
          />

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={() => { onRenameCol(col.id, titleVal || col.title); setEditingTitle(false); }}
              onKeyDown={e => {
                if (e.key === "Enter") { onRenameCol(col.id, titleVal || col.title); setEditingTitle(false); }
                if (e.key === "Escape") { setTitleVal(col.title); setEditingTitle(false); }
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, background: "transparent", border: "none", borderBottom: `1px solid ${theme.accent}`, color: theme.text, fontFamily: theme.font || "Syne", fontSize: 13, fontWeight: 700, outline: "none", minWidth: 0, letterSpacing: "-0.2px" }}
            />
          ) : (
            <div
              onDoubleClick={() => !isLocked && setEditingTitle(true)}
              title={isLocked ? undefined : "Double-click to rename"}
              style={{ fontSize: 13, fontWeight: 700, flex: 1, color: theme.text, cursor: isLocked ? "default" : "text", letterSpacing: "-0.2px" }}
            >
              {col.title}{isLocked && <span style={{ fontSize: 9, marginLeft: 5, color: theme.accent }}>🔒</span>}
            </div>
          )}

          {/* Card count badge */}
          <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: theme.text2, background: theme.surface3, padding: "2px 8px", borderRadius: 10 }}>
            {col.cards.length}
          </span>

          {/* Collapse button */}
          <div onClick={() => onToggleCollapse(col.id)} style={{ color: theme.text2, cursor: "pointer", display: "flex", opacity: 0.8 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}>
            <Icon d={isCollapsed ? Icons.chevronDown : Icons.chevronUp} size={12} />
          </div>
        </div>

        {!isCollapsed && (
          <CardDropZone
            colId={col.id}
            theme={theme}
            isCardDrag={isCardDrag && !isLocked}
            colMaxHeight={colMaxHeight}
            isEmpty={sortedCards.length === 0}
            hasActiveFilters={activeFilters.length > 0 || !!searchQuery}
          >
            <SortableContext items={sortedCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {sortedCards.map(card => (
                <SortableCard
                  key={card.id}
                  card={card}
                  isSelected={selectedCard?.id === card.id}
                  onClick={() => onSelectCard(card)}
                  onDelete={isLocked ? null : onDeleteCard}
                  onOpenInDaw={onOpenInDaw}
                  allTags={allTags}
                  theme={theme}
                  isLocked={isLocked}
                />
              ))}
            </SortableContext>
            {sortedCards.length === 0 && activeFilters.length > 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", color: theme.text3, fontSize: 12 }}>No cards match filter</div>
            )}
            {!isLocked && (
              <button
                onClick={() => onAddCard(col.id)}
                style={{ width: "100%", padding: "7px", background: "transparent", border: `1px solid ${theme.accent}40`, borderRadius: theme.r, color: theme.accent + "bb", cursor: "pointer", fontSize: 12, marginTop: 4, fontFamily: theme.font || "Syne", transition: "border-color 0.15s, color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent + "99"; e.currentTarget.style.color = theme.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.accent + "40"; e.currentTarget.style.color = theme.accent + "bb"; }}
              >
                + Add Project
              </button>
            )}
          </CardDropZone>
        )}
      </div>
    </div>
  );
}

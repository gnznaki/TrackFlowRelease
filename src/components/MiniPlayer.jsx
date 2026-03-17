import { useState, useEffect, useRef } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { Icon, Icons } from "./Icon";

async function findAudioPreview(projectPath) {
  try {
    const folder = projectPath.substring(0, projectPath.lastIndexOf("\\"));
    const entries = await readDir(folder);
    for (const entry of entries) {
      const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf("."));
      if ([".wav", ".mp3", ".ogg", ".flac"].includes(ext))
        return "asset://" + (folder + "\\" + entry.name).replace(/\\/g, "/");
    }
  } catch (e) {}
  return null;
}

export default function MiniPlayer({ projectPath, theme }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);
  useEffect(() => {
    setLoading(true); setPlaying(false); setProgress(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    findAudioPreview(projectPath).then(url => { setAudioUrl(url); setLoading(false); });
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };
  }, [projectPath]);
  function togglePlay(e) {
    e.stopPropagation();
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.ontimeupdate = () => setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }
  if (loading) return null;
  if (!audioUrl) return <div style={{ fontSize: 10, color: theme.text3, fontFamily: "monospace", marginTop: 8 }}>no audio preview</div>;
  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={togglePlay} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: playing ? theme.accent : theme.surface3, color: playing ? "#0a0a0b" : theme.text2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <Icon d={playing ? Icons.pause : Icons.play} size={10} />
      </button>
      <div onClick={e => { e.stopPropagation(); if (!audioRef.current) return; const rect = e.currentTarget.getBoundingClientRect(); audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration; }}
        style={{ flex: 1, height: 4, background: theme.surface3, borderRadius: 4, cursor: "pointer" }}>
        <div style={{ width: progress + "%", height: "100%", background: theme.accent, borderRadius: 4, transition: "width 0.1s" }} />
      </div>
    </div>
  );
}

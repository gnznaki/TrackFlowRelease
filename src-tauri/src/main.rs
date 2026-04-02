#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::time::UNIX_EPOCH;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn open_daw_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() { return Err("File does not exist".to_string()); }
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).unwrap_or_default();
    if !["flp", "als", "ptx", "ptf", "rpp"].contains(&ext.as_str()) { return Err("Not a DAW file".to_string()); }

    #[cfg(target_os = "windows")]
    {
        // If the DAW is already running, pass the file directly to its executable.
        // FL Studio and Reaper will open it in the existing instance; this avoids
        // spawning a second copy of the DAW on every "Open in DAW" click.
        if let Some(daw_exe) = find_running_daw_exe(&ext) {
            Command::new(&daw_exe).arg(&path).spawn().map_err(|e| e.to_string())?;
            return Ok(());
        }
        // DAW not running — open via Windows file association (starts a new instance).
        Command::new("cmd").args(["/C", "start", "", &path]).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

/// Use PowerShell to find the executable path of a running DAW process.
/// Returns `None` if the DAW isn't currently running.
#[cfg(target_os = "windows")]
fn find_running_daw_exe(ext: &str) -> Option<String> {
    let ps_cmd = match ext {
        "flp" =>
            "(Get-Process fl64 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)",
        "als" | "alc" =>
            "((Get-Process | Where-Object { $_.Path -like '*Ableton*' }) | Select-Object -First 1 -ExpandProperty Path)",
        "rpp" | "rpp-bak" =>
            "(Get-Process reaper -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)",
        "ptx" | "ptf" =>
            "((Get-Process | Where-Object { $_.Name -like 'Pro*Tools*' }) | Select-Object -First 1 -ExpandProperty Path)",
        _ => return None,
    };

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps_cmd])
        .output()
        .ok()?;

    let exe_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if exe_path.is_empty() || !Path::new(&exe_path).exists() {
        None
    } else {
        Some(exe_path)
    }
}

#[tauri::command]
fn get_file_modified(path: String) -> Result<u64, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    Ok(modified.duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis() as u64)
}

#[tauri::command]
fn save_app_state(app: tauri::AppHandle, state: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    std::fs::write(data_dir.join("trackflow-state.json"), state).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_app_state(app: tauri::AppHandle) -> Result<String, String> {
    let file_path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("trackflow-state.json");
    if !file_path.exists() { return Ok("".to_string()); }
    std::fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn backup_app_state(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = data_dir.join("trackflow-state.json");
    if !file_path.exists() { return Ok("No state to backup".to_string()); }
    let ts = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let backup = data_dir.join(format!("trackflow-backup-{}.json", ts));
    std::fs::copy(&file_path, &backup).map_err(|e| e.to_string())?;
    Ok(backup.to_string_lossy().to_string())
}

#[tauri::command]
fn get_save_folder(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_save_folder(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    let path = data_dir.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    { Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_project_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let dir = if p.is_dir() { p.to_path_buf() } else { p.parent().map(|d| d.to_path_buf()).unwrap_or_default() };
    let dir_str = dir.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    { Command::new("explorer").arg(&dir_str).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&dir_str).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&dir_str).spawn().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_daw_file, get_file_modified,
            save_app_state, load_app_state, backup_app_state, get_save_folder, open_save_folder, read_file_text,
            open_project_folder, restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

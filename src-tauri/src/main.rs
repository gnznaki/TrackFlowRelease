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
    if !["flp", "als", "ptx"].contains(&ext.as_str()) { return Err("Not a DAW file".to_string()); }
    #[cfg(target_os = "windows")]
    { Command::new("cmd").args(["/C", "start", "", &path]).spawn().map_err(|e| e.to_string())?; }
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    Ok(())
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

// Check for update — returns JSON with available/version info
// The state file is stored in AppData and is NEVER touched by updates.
// Updates only replace the app binary/resources.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => Ok(serde_json::json!({
            "available": true,
            "version": update.version,
            "notes": update.body.unwrap_or_default(),
            "date": update.date.map(|d| d.to_string()).unwrap_or_default()
        })),
        Ok(None) => Ok(serde_json::json!({ "available": false })),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    if let Some(update) = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_daw_file, get_file_modified,
            save_app_state, load_app_state, backup_app_state,
            check_for_update, install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

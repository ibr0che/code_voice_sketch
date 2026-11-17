use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{fs, path::PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

// All commands return `Ok(None)` when the user cancels the dialog, and
// `Err(message)` for real failures (surfaced as a rejected promise in JS).
//
// They are `async` on purpose: the blocking dialog APIs must not run on the
// main thread, and sync commands do.

fn pick_save_path(
    app: &AppHandle,
    title: &str,
    filter_name: &str,
    ext: &str,
    default_name: &str,
) -> Result<Option<PathBuf>, String> {
    app.dialog()
        .file()
        .set_title(title)
        .add_filter(filter_name, &[ext])
        .set_file_name(default_name)
        .blocking_save_file()
        .map(|p| p.into_path().map_err(|e| e.to_string()))
        .transpose()
}

fn write_file(path: &PathBuf, bytes: impl AsRef<[u8]>) -> Result<Option<String>, String> {
    fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Open a session JSON file (.algo). Returns its contents.
#[tauri::command]
pub async fn open_session(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Open Code Voice Sketch Session")
        .add_filter("Code Voice Sketch Session", &["algo"])
        .blocking_pick_file();

    match picked {
        Some(p) => {
            let path = p.into_path().map_err(|e| e.to_string())?;
            fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
        }
        None => Ok(None),
    }
}

/// Export a `data:image/png;base64,...` URL to disk. Returns the saved path.
#[tauri::command]
pub async fn export_png(app: AppHandle, data_url: String) -> Result<Option<String>, String> {
    let Some(path) = pick_save_path(&app, "Export Canvas as PNG", "PNG Image", "png", "code-voice-sketch.png")? else {
        return Ok(None);
    };
    // Strip the "data:image/png;base64," prefix if present
    let b64 = data_url.split_once(',').map_or(data_url.as_str(), |(_, rest)| rest);
    let bytes = STANDARD.decode(b64).map_err(|e| e.to_string())?;
    write_file(&path, bytes)
}

mod audio;
mod symphonia_player;
mod audio_new;
mod crossfade_engine;

use audio::{AudioPlayer, TrackMetadata, AlbumArtwork};
use crossfade_engine::{CrossfadeAudioPlayer, CrossfadeConfig, CrossfadeTrackInfo, CrossfadeCurve};
use std::sync::{Arc, Mutex};
use std::path::Path;
use std::fs;
use tauri::{State, Emitter};
use walkdir::WalkDir;

struct AppState {
    player: Arc<Mutex<AudioPlayer>>,
    crossfade_player: Arc<Mutex<Option<CrossfadeAudioPlayer>>>,
}

#[tauri::command]
fn play_song(path: String, state: State<AppState>) -> Result<f32, String> {
    let mut player = state.player.lock().unwrap();
    player.play(&path)
}

#[tauri::command]
fn pause(state: State<AppState>) -> Result<(), String> {
    let mut player = state.player.lock().unwrap();
    player.pause();
    Ok(())
}

#[tauri::command]
fn resume(state: State<AppState>) -> Result<(), String> {
    let mut player = state.player.lock().unwrap();
    player.resume();
    Ok(())
}

#[tauri::command]
fn stop(state: State<AppState>) -> Result<(), String> {
    let mut player = state.player.lock().unwrap();
    player.stop();
    Ok(())
}

#[tauri::command]
fn set_volume(volume: f32, state: State<AppState>) -> Result<(), String> {
    let mut player = state.player.lock().unwrap();
    player.set_volume(volume);
    Ok(())
}

#[tauri::command]
async fn seek(position: f32, state: State<'_, AppState>) -> Result<(), String> {
    // Use async to avoid blocking the main thread
    let player_arc = state.player.clone();
    
    tokio::task::spawn_blocking(move || {
        let player = player_arc.lock().unwrap();
        player.seek(position)
    }).await
    .map_err(|e| format!("Seek task failed: {}", e))?
}

#[tauri::command]
fn get_current_time(state: State<AppState>) -> Result<f32, String> {
    let player = state.player.lock().unwrap();
    Ok(player.get_current_time())
}

#[tauri::command]
fn get_song_info(state: State<AppState>) -> Result<(f32, f32), String> {
    let player = state.player.lock().unwrap();
    let current_time = player.get_current_time();
    let duration = player.get_duration();
    Ok((current_time, duration))
}

#[tauri::command]
fn get_track_metadata(path: String) -> Result<TrackMetadata, String> {
    AudioPlayer::get_track_metadata(&path)
}

#[tauri::command]
fn set_equalizer_band(frequency: u32, gain: f32, state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.set_equalizer_band(frequency, gain)
}

#[tauri::command]
fn set_equalizer_preset(gains: Vec<f32>, state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.set_equalizer_preset(gains)
}

#[tauri::command]
fn enable_equalizer(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.enable_equalizer(enabled)
}

#[tauri::command]
fn get_album_artwork(path: String) -> Result<Option<AlbumArtwork>, String> {
    AudioPlayer::get_album_artwork(&path)
}

#[derive(serde::Serialize, Clone)]
struct ScanProgress {
    current: usize,
    total: usize,
    current_file: String,
}

#[tauri::command]
async fn scan_music_folder(folder_path: String, window: tauri::Window) -> Result<Vec<String>, String> {
    let path = Path::new(&folder_path);
    
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }
    
    let mut music_files = Vec::new();
    let extensions = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "wma"];
    
    // First, count total files for progress
    let total_files: usize = WalkDir::new(&folder_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            if let Some(ext) = e.path().extension() {
                extensions.contains(&ext.to_str().unwrap_or("").to_lowercase().as_str())
            } else {
                false
            }
        })
        .count();
    
    let mut current = 0;
    
    // Now scan and collect files
    for entry in WalkDir::new(&folder_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if let Some(ext) = entry.path().extension() {
            if extensions.contains(&ext.to_str().unwrap_or("").to_lowercase().as_str()) {
                if let Some(path_str) = entry.path().to_str() {
                    music_files.push(path_str.to_string());
                    current += 1;
                    
                    // Emit progress event
                    let _ = window.emit("scan-progress", ScanProgress {
                        current,
                        total: total_files,
                        current_file: path_str.to_string(),
                    });
                }
            }
        }
    }
    
    Ok(music_files)
}

#[derive(serde::Serialize)]
struct MusicFileInfo {
    path: String,
    name: String,
    metadata: Option<TrackMetadata>,
}

#[tauri::command]
async fn get_music_files_metadata(paths: Vec<String>) -> Result<Vec<MusicFileInfo>, String> {
    let mut files_info = Vec::new();
    
    for path in paths {
        let name = Path::new(&path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path)
            .to_string();
        
        let metadata = AudioPlayer::get_track_metadata(&path).ok();
        
        files_info.push(MusicFileInfo {
            path,
            name,
            metadata,
        });
    }
    
    Ok(files_info)
}

#[tauri::command]
fn save_playlist_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to save playlist: {}", e))
}

// Crossfade commands
#[tauri::command]
fn enable_crossfade(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let mut crossfade_player = state.crossfade_player.lock().unwrap();
    
    if enabled && crossfade_player.is_none() {
        match CrossfadeAudioPlayer::new() {
            Ok(player) => {
                *crossfade_player = Some(player);
                Ok(())
            },
            Err(e) => Err(format!("Failed to initialize crossfade player: {}", e))
        }
    } else if let Some(ref player) = *crossfade_player {
        player.enable_crossfade(enabled);
        Ok(())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn set_crossfade_duration(duration: f32, state: State<AppState>) -> Result<(), String> {
    let crossfade_player = state.crossfade_player.lock().unwrap();
    if let Some(ref player) = *crossfade_player {
        player.set_crossfade_duration(duration);
        Ok(())
    } else {
        Err("Crossfade player not initialized".to_string())
    }
}

#[tauri::command]
fn get_crossfade_config(state: State<AppState>) -> Result<CrossfadeConfig, String> {
    let crossfade_player = state.crossfade_player.lock().unwrap();
    if let Some(ref player) = *crossfade_player {
        Ok(player.get_crossfade_config())
    } else {
        Ok(CrossfadeConfig::default())
    }
}

#[tauri::command]
fn get_crossfade_track_info(state: State<AppState>) -> Result<CrossfadeTrackInfo, String> {
    let crossfade_player = state.crossfade_player.lock().unwrap();
    if let Some(ref player) = *crossfade_player {
        Ok(player.get_track_info())
    } else {
        Ok(CrossfadeTrackInfo {
            duration: 0.0,
            current_time: 0.0,
            is_playing: false,
            crossfade_active: false,
            crossfade_progress: 0.0,
            current_track: None,
            next_track: None,
        })
    }
}

#[tauri::command]
fn play_song_with_crossfade(path: String, crossfade_duration: Option<f32>, state: State<AppState>) -> Result<(), String> {
    let crossfade_player = state.crossfade_player.lock().unwrap();
    if let Some(ref player) = *crossfade_player {
        player.play_with_crossfade(&path, crossfade_duration)
    } else {
        Err("Crossfade player not initialized".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let player = AudioPlayer::new().expect("Failed to initialize audio player");
    let app_state = AppState {
        player: Arc::new(Mutex::new(player)),
        crossfade_player: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            play_song,
            pause,
            resume,
            stop,
            set_volume,
            seek,
            get_current_time,
            get_song_info,
            get_track_metadata,
            set_equalizer_band,
            set_equalizer_preset,
            enable_equalizer,
            get_album_artwork,
            scan_music_folder,
            get_music_files_metadata,
            save_playlist_file,
            enable_crossfade,
            set_crossfade_duration,
            get_crossfade_config,
            get_crossfade_track_info,
            play_song_with_crossfade
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

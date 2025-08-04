mod audio;

use audio::{AudioPlayer, TrackMetadata};
use std::sync::{Arc, Mutex};
use tauri::State;

struct AppState {
    player: Arc<Mutex<AudioPlayer>>,
}

#[tauri::command]
fn play_song(path: String, state: State<AppState>) -> Result<f32, String> {
    let player = state.player.lock().unwrap();
    player.play(&path)
}

#[tauri::command]
fn pause(state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.pause();
    Ok(())
}

#[tauri::command]
fn resume(state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.resume();
    Ok(())
}

#[tauri::command]
fn stop(state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.stop();
    Ok(())
}

#[tauri::command]
fn set_volume(volume: f32, state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.set_volume(volume);
    Ok(())
}

#[tauri::command]
fn seek(position: f32, state: State<AppState>) -> Result<(), String> {
    let player = state.player.lock().unwrap();
    player.seek(position)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let player = AudioPlayer::new().expect("Failed to initialize audio player");
    let app_state = AppState {
        player: Arc::new(Mutex::new(player)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            enable_equalizer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

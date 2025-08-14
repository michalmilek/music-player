use rodio::{OutputStream, OutputStreamHandle, Sink, Source};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::path::Path;
use symphonia::core::codecs::CODEC_TYPE_NULL;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use std::fs::File;
use std::thread;
use std::sync::mpsc::{self, Receiver, Sender};

#[derive(Debug, Clone)]
pub enum CrossfadeCommand {
    Play(String),
    PlayWithCrossfade(String, f32), // path, crossfade_duration_seconds
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
    SetCrossfadeDuration(f32),
    EnableCrossfade(bool),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CrossfadeConfig {
    pub enabled: bool,
    pub duration_seconds: f32,
    pub curve_type: CrossfadeCurve,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum CrossfadeCurve {
    Linear,
    EqualPower,
    Logarithmic,
    SCurve,
}

impl Default for CrossfadeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            duration_seconds: 3.0,
            curve_type: CrossfadeCurve::EqualPower,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CrossfadeTrackInfo {
    pub duration: f64,
    pub current_time: f64,
    pub is_playing: bool,
    pub crossfade_active: bool,
    pub crossfade_progress: f32, // 0.0 to 1.0
    pub current_track: Option<String>,
    pub next_track: Option<String>,
}

struct AudioSource {
    sink: Sink,
    file_path: String,
    duration: f64,
    start_time: Instant,
    is_primary: bool,
}

pub struct CrossfadeAudioPlayer {
    command_sender: Sender<CrossfadeCommand>,
    track_info: Arc<Mutex<CrossfadeTrackInfo>>,
    crossfade_config: Arc<Mutex<CrossfadeConfig>>,
    _audio_thread: thread::JoinHandle<()>,
}

impl CrossfadeAudioPlayer {
    pub fn new() -> Result<Self, String> {
        let (command_sender, command_receiver) = mpsc::channel();
        let track_info = Arc::new(Mutex::new(CrossfadeTrackInfo {
            duration: 0.0,
            current_time: 0.0,
            is_playing: false,
            crossfade_active: false,
            crossfade_progress: 0.0,
            current_track: None,
            next_track: None,
        }));
        let crossfade_config = Arc::new(Mutex::new(CrossfadeConfig::default()));

        let track_info_clone = track_info.clone();
        let crossfade_config_clone = crossfade_config.clone();
        
        let audio_thread = thread::spawn(move || {
            Self::audio_thread(command_receiver, track_info_clone, crossfade_config_clone);
        });

        Ok(Self {
            command_sender,
            track_info,
            crossfade_config,
            _audio_thread: audio_thread,
        })
    }

    fn audio_thread(
        command_receiver: Receiver<CrossfadeCommand>,
        track_info: Arc<Mutex<CrossfadeTrackInfo>>,
        crossfade_config: Arc<Mutex<CrossfadeConfig>>,
    ) {
        let (_stream, stream_handle) = OutputStream::try_default().unwrap();
        let mut current_source: Option<AudioSource> = None;
        let mut crossfade_source: Option<AudioSource> = None;
        let mut crossfade_start_time: Option<Instant> = None;
        let mut master_volume = 0.5f32;

        // Track info update will be handled in the main loop

        loop {
            if let Ok(command) = command_receiver.try_recv() {
                match command {
                    CrossfadeCommand::Play(path) => {
                        Self::stop_current_playback(&mut current_source, &mut crossfade_source);
                        
                        if let Ok(sink) = Self::create_audio_source(&stream_handle, &path) {
                            let duration = Self::get_file_duration(&path).unwrap_or(0.0);
                            
                            if let Ok(mut info) = track_info.lock() {
                                info.duration = duration;
                                info.current_time = 0.0;
                                info.is_playing = true;
                                info.crossfade_active = false;
                                info.current_track = Some(path.clone());
                                info.next_track = None;
                            }
                            
                            sink.set_volume(master_volume);
                            current_source = Some(AudioSource {
                                sink,
                                file_path: path,
                                duration,
                                start_time: Instant::now(),
                                is_primary: true,
                            });
                        }
                    },
                    
                    CrossfadeCommand::PlayWithCrossfade(path, crossfade_duration) => {
                        let crossfade_enabled = {
                            let config = crossfade_config.lock().unwrap();
                            config.enabled
                        };
                        
                        if !crossfade_enabled {
                            // If crossfade is disabled, just play normally
                            Self::stop_current_playback(&mut current_source, &mut crossfade_source);
                            
                            if let Ok(sink) = Self::create_audio_source(&stream_handle, &path) {
                                let duration = Self::get_file_duration(&path).unwrap_or(0.0);
                                
                                if let Ok(mut info) = track_info.lock() {
                                    info.duration = duration;
                                    info.current_time = 0.0;
                                    info.is_playing = true;
                                    info.crossfade_active = false;
                                    info.current_track = Some(path.clone());
                                    info.next_track = None;
                                }
                                
                                sink.set_volume(master_volume);
                                current_source = Some(AudioSource {
                                    sink,
                                    file_path: path,
                                    duration,
                                    start_time: Instant::now(),
                                    is_primary: true,
                                });
                            }
                            continue;
                        }

                        if let Some(ref mut current) = current_source {
                            // Start crossfade
                            if let Ok(new_sink) = Self::create_audio_source(&stream_handle, &path) {
                                let duration = Self::get_file_duration(&path).unwrap_or(0.0);
                                
                                if let Ok(mut info) = track_info.lock() {
                                    info.crossfade_active = true;
                                    info.crossfade_progress = 0.0;
                                    info.next_track = Some(path.clone());
                                }
                                
                                // Start the new source at low volume
                                new_sink.set_volume(0.0);
                                
                                crossfade_source = Some(AudioSource {
                                    sink: new_sink,
                                    file_path: path,
                                    duration,
                                    start_time: Instant::now(),
                                    is_primary: false,
                                });
                                
                                crossfade_start_time = Some(Instant::now());
                            }
                        } else {
                            // No current source, just play normally
                            if let Ok(sink) = Self::create_audio_source(&stream_handle, &path) {
                                let duration = Self::get_file_duration(&path).unwrap_or(0.0);
                                
                                if let Ok(mut info) = track_info.lock() {
                                    info.duration = duration;
                                    info.current_time = 0.0;
                                    info.is_playing = true;
                                    info.crossfade_active = false;
                                    info.current_track = Some(path.clone());
                                    info.next_track = None;
                                }
                                
                                sink.set_volume(master_volume);
                                current_source = Some(AudioSource {
                                    sink,
                                    file_path: path,
                                    duration,
                                    start_time: Instant::now(),
                                    is_primary: true,
                                });
                            }
                        }
                    },
                    
                    CrossfadeCommand::Pause => {
                        if let Some(ref source) = current_source {
                            source.sink.pause();
                        }
                        if let Some(ref source) = crossfade_source {
                            source.sink.pause();
                        }
                        if let Ok(mut info) = track_info.lock() {
                            info.is_playing = false;
                        }
                    },
                    
                    CrossfadeCommand::Resume => {
                        if let Some(ref source) = current_source {
                            source.sink.play();
                        }
                        if let Some(ref source) = crossfade_source {
                            source.sink.play();
                        }
                        if let Ok(mut info) = track_info.lock() {
                            info.is_playing = true;
                        }
                    },
                    
                    CrossfadeCommand::Stop => {
                        Self::stop_current_playback(&mut current_source, &mut crossfade_source);
                        crossfade_start_time = None;
                        
                        if let Ok(mut info) = track_info.lock() {
                            info.is_playing = false;
                            info.current_time = 0.0;
                            info.crossfade_active = false;
                            info.current_track = None;
                            info.next_track = None;
                        }
                    },
                    
                    CrossfadeCommand::SetVolume(volume) => {
                        master_volume = volume;
                        if let Some(ref source) = current_source {
                            if !track_info.lock().unwrap().crossfade_active {
                                source.sink.set_volume(volume);
                            }
                        }
                    },
                    
                    CrossfadeCommand::SetCrossfadeDuration(duration) => {
                        if let Ok(mut config) = crossfade_config.lock() {
                            config.duration_seconds = duration;
                        }
                    },
                    
                    CrossfadeCommand::EnableCrossfade(enabled) => {
                        if let Ok(mut config) = crossfade_config.lock() {
                            config.enabled = enabled;
                        }
                    },
                    
                    _ => {},
                }
            }

            // Handle crossfade progression
            if let (Some(ref start_time), Some(ref mut crossfade), Some(ref mut current)) = 
                (crossfade_start_time, &mut crossfade_source, &mut current_source) {
                
                let config = crossfade_config.lock().unwrap();
                let crossfade_duration = Duration::from_secs_f32(config.duration_seconds);
                let elapsed = start_time.elapsed();
                
                if elapsed < crossfade_duration {
                    // Calculate crossfade progress (0.0 to 1.0)
                    let progress = elapsed.as_secs_f32() / config.duration_seconds;
                    
                    // Apply crossfade curve
                    let (current_volume, next_volume) = Self::calculate_crossfade_volumes(
                        progress, 
                        &config.curve_type, 
                        master_volume
                    );
                    
                    current.sink.set_volume(current_volume);
                    crossfade.sink.set_volume(next_volume);
                    
                    if let Ok(mut info) = track_info.lock() {
                        info.crossfade_progress = progress;
                    }
                } else {
                    // Crossfade complete - switch to new source
                    current.sink.stop();
                    crossfade.sink.set_volume(master_volume);
                    
                    if let Ok(mut info) = track_info.lock() {
                        info.crossfade_active = false;
                        info.crossfade_progress = 1.0;
                        info.current_track = info.next_track.clone();
                        info.next_track = None;
                        info.duration = crossfade.duration;
                        info.current_time = 0.0;
                    }
                    
                    // Stop the old source
                    current.sink.stop();
                    
                    // Move crossfade to current
                    if let Some(new_current) = crossfade_source.take() {
                        current_source = Some(AudioSource {
                            sink: new_current.sink,
                            file_path: new_current.file_path,
                            duration: new_current.duration,
                            start_time: Instant::now(),
                            is_primary: true,
                        });
                    }
                    crossfade_start_time = None;
                }
            }

            thread::sleep(Duration::from_millis(50));
        }
    }

    fn calculate_crossfade_volumes(
        progress: f32, 
        curve_type: &CrossfadeCurve, 
        master_volume: f32
    ) -> (f32, f32) {
        let (fade_out, fade_in) = match curve_type {
            CrossfadeCurve::Linear => {
                (1.0 - progress, progress)
            },
            CrossfadeCurve::EqualPower => {
                let fade_out = (1.0 - progress).sqrt();
                let fade_in = progress.sqrt();
                (fade_out, fade_in)
            },
            CrossfadeCurve::Logarithmic => {
                let fade_out = (1.0 - progress).powf(2.0);
                let fade_in = progress.powf(0.5);
                (fade_out, fade_in)
            },
            CrossfadeCurve::SCurve => {
                // Smooth S-curve using smoothstep function
                let smooth_progress = progress * progress * (3.0 - 2.0 * progress);
                (1.0 - smooth_progress, smooth_progress)
            },
        };
        
        (fade_out * master_volume, fade_in * master_volume)
    }

    fn create_audio_source(stream_handle: &OutputStreamHandle, file_path: &str) -> Result<Sink, String> {
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());
        
        let mut hint = Hint::new();
        if let Some(extension) = Path::new(file_path).extension() {
            if let Some(ext_str) = extension.to_str() {
                hint.with_extension(ext_str);
            }
        }

        let meta_opts: MetadataOptions = Default::default();
        let fmt_opts: FormatOptions = Default::default();

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &fmt_opts, &meta_opts)
            .map_err(|e| format!("Failed to probe format: {}", e))?;

        let mut format = probed.format;
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No suitable audio track found")?;

        let track_id = track.id;
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &Default::default())
            .map_err(|e| format!("Failed to create decoder: {}", e))?;

        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;

        // Create a source from the decoder
        let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
        let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2) as u16;

        // This is a simplified version - in reality you'd need to implement a proper Source
        // that reads from the Symphonia decoder. For now, let's use rodio's built-in decoder.
        let file_for_source = File::open(file_path).map_err(|e| format!("Failed to open file for source: {}", e))?;
        let source = rodio::Decoder::new(file_for_source).map_err(|e| format!("Failed to create decoder: {}", e))?;
        
        sink.append(source);
        sink.pause(); // Start paused
        
        Ok(sink)
    }

    fn get_file_duration(file_path: &str) -> Result<f64, String> {
        // This would use the same logic as the existing get_track_metadata function
        // For now, return a placeholder
        Ok(0.0)
    }

    fn stop_current_playback(
        current_source: &mut Option<AudioSource>,
        crossfade_source: &mut Option<AudioSource>,
    ) {
        if let Some(source) = current_source.take() {
            source.sink.stop();
        }
        if let Some(source) = crossfade_source.take() {
            source.sink.stop();
        }
    }

    // Public interface methods
    pub fn play(&self, path: &str) -> Result<(), String> {
        self.command_sender
            .send(CrossfadeCommand::Play(path.to_string()))
            .map_err(|e| format!("Failed to send play command: {}", e))
    }

    pub fn play_with_crossfade(&self, path: &str, crossfade_duration: Option<f32>) -> Result<(), String> {
        let duration = crossfade_duration.unwrap_or_else(|| {
            self.crossfade_config.lock().unwrap().duration_seconds
        });
        
        self.command_sender
            .send(CrossfadeCommand::PlayWithCrossfade(path.to_string(), duration))
            .map_err(|e| format!("Failed to send crossfade play command: {}", e))
    }

    pub fn pause(&self) {
        let _ = self.command_sender.send(CrossfadeCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.command_sender.send(CrossfadeCommand::Resume);
    }

    pub fn stop(&self) {
        let _ = self.command_sender.send(CrossfadeCommand::Stop);
    }

    pub fn set_volume(&self, volume: f32) {
        let _ = self.command_sender.send(CrossfadeCommand::SetVolume(volume));
    }

    pub fn set_crossfade_duration(&self, duration: f32) {
        let _ = self.command_sender.send(CrossfadeCommand::SetCrossfadeDuration(duration));
    }

    pub fn enable_crossfade(&self, enabled: bool) {
        let _ = self.command_sender.send(CrossfadeCommand::EnableCrossfade(enabled));
    }

    pub fn get_track_info(&self) -> CrossfadeTrackInfo {
        self.track_info.lock().unwrap().clone()
    }

    pub fn get_crossfade_config(&self) -> CrossfadeConfig {
        self.crossfade_config.lock().unwrap().clone()
    }
}
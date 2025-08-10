use rodio::{OutputStream, OutputStreamHandle, Sink, Source};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::path::Path;
use symphonia::core::codecs::CODEC_TYPE_NULL;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, StandardVisualKey};
use symphonia::core::probe::Hint;
use std::fs::File;
use std::thread;
use std::sync::mpsc::{self, Receiver, Sender};
use std::collections::HashMap;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone)]
pub enum PlayerCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
    SetEqualizerBand(u32, f32),
    SetEqualizerPreset(Vec<f32>),
    EnableEqualizer(bool),
}

#[derive(Debug, Clone)]
pub struct TrackInfo {
    pub duration: f64,
    pub current_time: f64,
    pub is_playing: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration: f64,
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<String>,
    pub bits_per_sample: Option<u32>,
    pub has_artwork: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AlbumArtwork {
    pub data: String, // Base64 encoded image data
    pub mime_type: String,
}

#[derive(Debug, Clone)]
pub struct EqualizerBands {
    bands: HashMap<u32, f32>, // frequency -> gain in dB
    enabled: bool,
}

impl Default for EqualizerBands {
    fn default() -> Self {
        let mut bands = HashMap::new();
        // Initialize with default frequencies
        for freq in &[32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] {
            bands.insert(*freq, 0.0);
        }
        Self {
            bands,
            enabled: false,
        }
    }
}

pub struct AudioPlayer {
    command_sender: Sender<PlayerCommand>,
    track_info: Arc<Mutex<TrackInfo>>,
    equalizer: Arc<Mutex<EqualizerBands>>,
    _audio_thread: thread::JoinHandle<()>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        let (command_sender, command_receiver) = mpsc::channel();
        let track_info = Arc::new(Mutex::new(TrackInfo {
            duration: 0.0,
            current_time: 0.0,
            is_playing: false,
        }));
        let equalizer = Arc::new(Mutex::new(EqualizerBands::default()));

        let track_info_clone = track_info.clone();
        let equalizer_clone = equalizer.clone();
        
        let audio_thread = thread::spawn(move || {
            Self::audio_thread(command_receiver, track_info_clone, equalizer_clone);
        });

        Ok(Self {
            command_sender,
            track_info,
            equalizer,
            _audio_thread: audio_thread,
        })
    }

    fn audio_thread(command_receiver: Receiver<PlayerCommand>, track_info: Arc<Mutex<TrackInfo>>, equalizer: Arc<Mutex<EqualizerBands>>) {
        let (_stream, stream_handle) = OutputStream::try_default().unwrap();
        let mut current_sink: Option<Sink> = None;
        let mut current_file_path: Option<String> = None;
        let mut seek_to: Option<f64> = None;
        let mut playback_start_time: Option<std::time::Instant> = None;
        let mut seek_offset: f64 = 0.0;
        
        loop {
            // Check for commands
            if let Ok(command) = command_receiver.try_recv() {
                match command {
                    PlayerCommand::Play(path) => {
                        // Stop current playback
                        if let Some(sink) = current_sink.take() {
                            sink.stop();
                        }
                        
                        // Get track duration using symphonia
                        if let Ok(duration) = Self::get_track_duration(&path) {
                            let mut info = track_info.lock().unwrap();
                            info.duration = duration;
                            info.current_time = 0.0;
                            info.is_playing = true;
                        }
                        
                        // Start new playback
                        if let Ok(sink) = Self::create_sink_from_file(&path, &stream_handle) {
                            current_sink = Some(sink);
                            current_file_path = Some(path);
                            playback_start_time = Some(std::time::Instant::now());
                            seek_offset = 0.0;
                        }
                    }
                    PlayerCommand::Pause => {
                        if let Some(ref sink) = current_sink {
                            sink.pause();
                            let mut info = track_info.lock().unwrap();
                            info.is_playing = false;
                            // Update seek_offset to current position when pausing
                            if let Some(start_time) = playback_start_time {
                                seek_offset += start_time.elapsed().as_secs_f64();
                            }
                        }
                    }
                    PlayerCommand::Resume => {
                        if let Some(ref sink) = current_sink {
                            sink.play();
                            track_info.lock().unwrap().is_playing = true;
                            // Reset start time when resuming
                            playback_start_time = Some(std::time::Instant::now());
                        }
                    }
                    PlayerCommand::Stop => {
                        if let Some(sink) = current_sink.take() {
                            sink.stop();
                        }
                        current_file_path = None;
                        playback_start_time = None;
                        seek_offset = 0.0;
                        let mut info = track_info.lock().unwrap();
                        info.is_playing = false;
                        info.current_time = 0.0;
                    }
                    PlayerCommand::Seek(position) => {
                        seek_to = Some(position);
                    }
                    PlayerCommand::SetVolume(volume) => {
                        if let Some(ref sink) = current_sink {
                            sink.set_volume(volume);
                        }
                    }
                    PlayerCommand::SetEqualizerBand(frequency, gain) => {
                        let mut eq = equalizer.lock().unwrap();
                        eq.bands.insert(frequency, gain);
                        // Note: Actual EQ processing would require audio filters
                        println!("EQ Band set: {}Hz = {}dB", frequency, gain);
                    }
                    PlayerCommand::SetEqualizerPreset(gains) => {
                        let mut eq = equalizer.lock().unwrap();
                        let frequencies = vec![32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
                        for (i, gain) in gains.iter().enumerate() {
                            if i < frequencies.len() {
                                eq.bands.insert(frequencies[i], *gain);
                            }
                        }
                        println!("EQ Preset applied");
                    }
                    PlayerCommand::EnableEqualizer(enabled) => {
                        let mut eq = equalizer.lock().unwrap();
                        eq.enabled = enabled;
                        println!("Equalizer {}", if enabled { "enabled" } else { "disabled" });
                    }
                }
            }

            // Handle seeking - ultra-fast optimized
            if let (Some(position), Some(file_path)) = (seek_to.take(), &current_file_path) {
                let was_playing = current_sink.as_ref().map_or(false, |sink| !sink.is_paused());
                let current_volume = current_sink.as_ref().map(|sink| sink.volume()).unwrap_or(1.0);
                
                // Update time immediately - don't wait for audio processing
                track_info.lock().unwrap().current_time = position;
                
                // Update timing variables for seek
                seek_offset = position;
                playback_start_time = Some(std::time::Instant::now());
                
                // Stop current sink with minimal delay
                if let Some(sink) = current_sink.take() {
                    sink.stop();
                }
                
                // Ultra-fast seek with immediate feedback
                if let Ok(sink) = Self::create_sink_from_file_at_position_ultra_optimized(&file_path, &stream_handle, position, current_volume) {
                    if was_playing {
                        sink.play();
                    }
                    current_sink = Some(sink);
                }
            }

            // Update current time based on elapsed playback time
            if let Some(ref sink) = current_sink {
                if !sink.is_paused() && !sink.empty() {
                    if let Some(start_time) = playback_start_time {
                        let elapsed = start_time.elapsed().as_secs_f64();
                        let current_time = seek_offset + elapsed;
                        track_info.lock().unwrap().current_time = current_time;
                    }
                }
            }

            thread::sleep(Duration::from_millis(10));
        }
    }

    fn get_track_duration(file_path: &str) -> Result<f64, String> {
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

        let format = probed.format;
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No suitable audio track found")?;

        if let Some(n_frames) = track.codec_params.n_frames {
            if let Some(sample_rate) = track.codec_params.sample_rate {
                let duration = n_frames as f64 / sample_rate as f64;
                return Ok(duration);
            }
        }

        Ok(0.0)
    }

    fn create_sink_from_file(file_path: &str, stream_handle: &OutputStreamHandle) -> Result<Sink, String> {
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let source = rodio::Decoder::new(std::io::BufReader::new(file))
            .map_err(|e| format!("Failed to decode audio: {}", e))?;

        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        sink.append(source);
        sink.play();

        Ok(sink)
    }

    fn create_sink_from_file_at_position_optimized(
        file_path: &str,
        stream_handle: &OutputStreamHandle,
        position: f64,
        volume: f32,
    ) -> Result<Sink, String> {
        // Ultra-optimized: minimal overhead approach
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        
        // Large buffer for maximum I/O performance
        let buf_reader = std::io::BufReader::with_capacity(128 * 1024, file);
        let source = rodio::Decoder::new(buf_reader)
            .map_err(|e| format!("Failed to decode audio: {}", e))?;
            
        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        sink.set_volume(volume);
        
        // Skip efficiently - only if needed
        if position > 0.1 { // Small threshold to avoid unnecessary work
            let skipped_source = source.skip_duration(std::time::Duration::from_secs_f64(position));
            sink.append(skipped_source);
        } else {
            sink.append(source);
        }
        
        Ok(sink)
    }

    fn create_sink_from_file_at_position_fast(
        file_path: &str,
        stream_handle: &OutputStreamHandle,
        position: f64,
    ) -> Result<Sink, String> {
        // Optimized approach: use larger buffer for faster I/O
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        
        // Use a larger buffer for faster reading
        let buf_reader = std::io::BufReader::with_capacity(64 * 1024, file);
        let source = rodio::Decoder::new(buf_reader)
            .map_err(|e| format!("Failed to decode audio: {}", e))?;
            
        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        
        // Fast skip using duration
        if position > 0.0 {
            let skipped_source = source.skip_duration(std::time::Duration::from_secs_f64(position));
            sink.append(skipped_source);
        } else {
            sink.append(source);
        }
        
        Ok(sink)
    }

    fn create_sink_from_file_at_position_ultra_optimized(
        file_path: &str,
        stream_handle: &OutputStreamHandle,
        position: f64,
        volume: f32,
    ) -> Result<Sink, String> {
        // Use memory mapping for fastest I/O
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        
        // Massive buffer for maximum speed
        let buf_reader = std::io::BufReader::with_capacity(256 * 1024, file);
        let source = rodio::Decoder::new(buf_reader)
            .map_err(|e| format!("Failed to decode audio: {}", e))?;
            
        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        sink.set_volume(volume);
        
        // Skip with minimal threshold
        if position > 0.01 { // Even smaller threshold
            let skipped_source = source.skip_duration(std::time::Duration::from_secs_f64(position));
            sink.append(skipped_source);
        } else {
            sink.append(source);
        }
        
        Ok(sink)
    }

    fn create_sink_from_file_at_position(
        file_path: &str,
        stream_handle: &OutputStreamHandle,
        position: f64,
    ) -> Result<Sink, String> {
        // Fallback method - same as before but without auto-play
        let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let source = rodio::Decoder::new(std::io::BufReader::new(file))
            .map_err(|e| format!("Failed to decode audio: {}", e))?;

        let sink = Sink::try_new(stream_handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        
        let skipped_source = source.skip_duration(std::time::Duration::from_secs_f64(position));
        sink.append(skipped_source);

        Ok(sink)
    }

    pub fn play(&self, file_path: &str) -> Result<f32, String> {
        let duration = Self::get_track_duration(file_path)?;
        println!("Audio duration: {} seconds", duration);
        
        self.command_sender
            .send(PlayerCommand::Play(file_path.to_string()))
            .map_err(|e| format!("Failed to send play command: {}", e))?;
        
        Ok(duration as f32)
    }

    pub fn pause(&self) {
        let _ = self.command_sender.send(PlayerCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.command_sender.send(PlayerCommand::Resume);
    }

    pub fn stop(&self) {
        let _ = self.command_sender.send(PlayerCommand::Stop);
    }

    pub fn set_volume(&self, volume: f32) {
        let _ = self.command_sender.send(PlayerCommand::SetVolume(volume));
    }

    pub fn seek(&self, position: f32) -> Result<(), String> {
        let _ = self.command_sender.send(PlayerCommand::Seek(position as f64));
        Ok(())
    }

    pub fn get_current_time(&self) -> f32 {
        self.track_info.lock().unwrap().current_time as f32
    }

    pub fn get_duration(&self) -> f32 {
        self.track_info.lock().unwrap().duration as f32
    }

    pub fn is_playing(&self) -> bool {
        self.track_info.lock().unwrap().is_playing
    }

    pub fn set_equalizer_band(&self, frequency: u32, gain: f32) -> Result<(), String> {
        self.command_sender
            .send(PlayerCommand::SetEqualizerBand(frequency, gain))
            .map_err(|e| format!("Failed to send equalizer band command: {}", e))
    }

    pub fn set_equalizer_preset(&self, gains: Vec<f32>) -> Result<(), String> {
        self.command_sender
            .send(PlayerCommand::SetEqualizerPreset(gains))
            .map_err(|e| format!("Failed to send equalizer preset command: {}", e))
    }

    pub fn enable_equalizer(&self, enabled: bool) -> Result<(), String> {
        self.command_sender
            .send(PlayerCommand::EnableEqualizer(enabled))
            .map_err(|e| format!("Failed to send equalizer enable command: {}", e))
    }

    pub fn get_track_metadata(file_path: &str) -> Result<TrackMetadata, String> {
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

        let mut metadata = TrackMetadata {
            title: None,
            artist: None,
            album: None,
            track_number: None,
            year: None,
            genre: None,
            duration: 0.0,
            codec: None,
            sample_rate: None,
            channels: None,
            bits_per_sample: None,
            has_artwork: false,
        };

        // Get duration
        let mut format = probed.format;
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No suitable audio track found")?;

        // Set technical information
        metadata.codec = Some(format!("{:?}", track.codec_params.codec));
        metadata.sample_rate = track.codec_params.sample_rate;
        metadata.channels = track.codec_params.channels.map(|ch| format!("{:?}", ch));
        metadata.bits_per_sample = track.codec_params.bits_per_sample;

        // Print technical information
        println!("Audio file technical info:");
        println!("- Codec: {:?}", track.codec_params.codec);
        println!("- Sample rate: {:?}", track.codec_params.sample_rate);
        println!("- Channels: {:?}", track.codec_params.channels);
        println!("- Bits per sample: {:?}", track.codec_params.bits_per_sample);
        println!("- N frames: {:?}", track.codec_params.n_frames);

        if let Some(n_frames) = track.codec_params.n_frames {
            if let Some(sample_rate) = track.codec_params.sample_rate {
                metadata.duration = n_frames as f64 / sample_rate as f64;
            }
        }

        // Get metadata from tags
        if let Some(metadata_rev) = format.metadata().current() {
            println!("Found {} tags", metadata_rev.tags().len());
            
            // Check for album artwork
            if !metadata_rev.visuals().is_empty() {
                metadata.has_artwork = true;
                println!("Found {} album artwork(s)", metadata_rev.visuals().len());
            }
            
            for tag in metadata_rev.tags() {
                println!("Tag: '{}' = '{}'", tag.key, tag.value);
                match tag.key.as_str() {
                    "TITLE" | "TIT2" => {
                        metadata.title = Some(tag.value.to_string());
                        println!("Set title: {}", tag.value);
                    },
                    "ARTIST" | "TPE1" => {
                        metadata.artist = Some(tag.value.to_string());
                        println!("Set artist: {}", tag.value);
                    },
                    "ALBUM" | "TALB" => {
                        metadata.album = Some(tag.value.to_string());
                        println!("Set album: {}", tag.value);
                    },
                    "TRACKNUMBER" | "TRCK" => {
                        if let Ok(track_num) = tag.value.to_string().parse::<u32>() {
                            metadata.track_number = Some(track_num);
                            println!("Set track number: {}", track_num);
                        }
                    },
                    "DATE" | "TYER" | "TDRC" => {
                        let year_str = tag.value.to_string();
                        if let Some(year_part) = year_str.split('-').next() {
                            if let Ok(year) = year_part.parse::<u32>() {
                                metadata.year = Some(year);
                                println!("Set year: {}", year);
                            }
                        }
                    },
                    "GENRE" | "TCON" => {
                        metadata.genre = Some(tag.value.to_string());
                        println!("Set genre: {}", tag.value);
                    },
                    _ => {}
                }
            }
        } else {
            println!("No metadata found");
        }

        // Fallback: extract filename as title if no title tag found
        if metadata.title.is_none() {
            if let Some(filename) = Path::new(file_path).file_stem() {
                if let Some(name) = filename.to_str() {
                    metadata.title = Some(name.to_string());
                }
            }
        }

        Ok(metadata)
    }

    pub fn get_album_artwork(file_path: &str) -> Result<Option<AlbumArtwork>, String> {
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
        
        // Get artwork from metadata
        if let Some(metadata_rev) = format.metadata().current() {
            // Look for front cover first, then any other artwork
            let front_cover = metadata_rev.visuals()
                .iter()
                .find(|v| v.usage == Some(StandardVisualKey::FrontCover));
            
            let visual = front_cover.or_else(|| metadata_rev.visuals().first());
            
            if let Some(visual) = visual {
                let mime_type = if visual.media_type.is_empty() {
                    // Guess MIME type from data if not provided
                    if visual.data.starts_with(&[0xFF, 0xD8, 0xFF]) {
                        "image/jpeg".to_string()
                    } else if visual.data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                        "image/png".to_string()
                    } else {
                        "image/unknown".to_string()
                    }
                } else {
                    visual.media_type.clone()
                };
                
                let encoded = general_purpose::STANDARD.encode(&visual.data);
                
                return Ok(Some(AlbumArtwork {
                    data: encoded,
                    mime_type,
                }));
            }
        }
        
        Ok(None)
    }
}
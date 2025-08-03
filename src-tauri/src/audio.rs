use rodio::{OutputStream, OutputStreamHandle, Sink};
use std::sync::{Arc, Mutex};
use std::time::Duration;
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
pub enum PlayerCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
}

#[derive(Debug, Clone)]
pub struct TrackInfo {
    pub duration: f64,
    pub current_time: f64,
    pub is_playing: bool,
}

pub struct AudioPlayer {
    command_sender: Sender<PlayerCommand>,
    track_info: Arc<Mutex<TrackInfo>>,
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

        let track_info_clone = track_info.clone();
        
        let audio_thread = thread::spawn(move || {
            Self::audio_thread(command_receiver, track_info_clone);
        });

        Ok(Self {
            command_sender,
            track_info,
            _audio_thread: audio_thread,
        })
    }

    fn audio_thread(command_receiver: Receiver<PlayerCommand>, track_info: Arc<Mutex<TrackInfo>>) {
        let (_stream, stream_handle) = OutputStream::try_default().unwrap();
        let mut current_sink: Option<Sink> = None;
        let mut current_file_path: Option<String> = None;
        let mut seek_to: Option<f64> = None;
        
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
                        }
                    }
                    PlayerCommand::Pause => {
                        if let Some(ref sink) = current_sink {
                            sink.pause();
                            track_info.lock().unwrap().is_playing = false;
                        }
                    }
                    PlayerCommand::Resume => {
                        if let Some(ref sink) = current_sink {
                            sink.play();
                            track_info.lock().unwrap().is_playing = true;
                        }
                    }
                    PlayerCommand::Stop => {
                        if let Some(sink) = current_sink.take() {
                            sink.stop();
                        }
                        current_file_path = None;
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
                }
            }

            // Handle seeking
            if let (Some(position), Some(file_path)) = (seek_to.take(), &current_file_path) {
                if let Some(sink) = current_sink.take() {
                    sink.stop();
                }
                
                if let Ok(sink) = Self::create_sink_from_file_at_position(file_path, &stream_handle, position) {
                    current_sink = Some(sink);
                    track_info.lock().unwrap().current_time = position;
                }
            }

            // Update current time (simple estimation)
            if let Some(ref sink) = current_sink {
                if !sink.is_paused() && !sink.empty() {
                    // This is a very basic time tracking - for real seeking we'd need more sophisticated tracking
                    // For now, we'll rely on the frontend timer
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

    fn create_sink_from_file_at_position(
        file_path: &str,
        stream_handle: &OutputStreamHandle,
        _position: f64,
    ) -> Result<Sink, String> {
        // Seeking is very complex with symphonia + rodio
        // For now, just don't seek to avoid restarting
        Err("Seeking not implemented".to_string())
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
}
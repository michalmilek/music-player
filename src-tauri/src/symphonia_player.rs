use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device,
};
use ringbuf::HeapRb;
use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, StandardTagKey};
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

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
    pub data: String,
    pub mime_type: String,
}

#[derive(Debug, Clone)]
pub struct PlayerState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub current_time: f64,
    pub duration: f64,
    pub volume: f32,
    pub file_path: Option<String>,
}

pub struct SymphoniaPlayer {
    state: Arc<Mutex<PlayerState>>,
    should_stop: Arc<AtomicBool>,
    seek_position: Arc<Mutex<Option<f64>>>,
    volume: Arc<Mutex<f32>>,
    player_thread: Option<thread::JoinHandle<()>>,
}

impl SymphoniaPlayer {
    pub fn new() -> Result<Self, String> {
        let state = Arc::new(Mutex::new(PlayerState {
            is_playing: false,
            is_paused: false,
            current_time: 0.0,
            duration: 0.0,
            volume: 1.0,
            file_path: None,
        }));

        Ok(SymphoniaPlayer {
            state,
            should_stop: Arc::new(AtomicBool::new(false)),
            seek_position: Arc::new(Mutex::new(None)),
            volume: Arc::new(Mutex::new(1.0)),
            player_thread: None,
        })
    }

    pub fn play(&mut self, file_path: &str) -> Result<f32, String> {
        // Stop current playback
        self.stop();

        // Get track metadata first
        let metadata = Self::get_track_metadata(file_path)?;
        let duration = metadata.duration as f32;

        // Update state
        {
            let mut state = self.state.lock().unwrap();
            state.file_path = Some(file_path.to_string());
            state.duration = metadata.duration;
            state.current_time = 0.0;
            state.is_playing = true;
            state.is_paused = false;
        }

        // Reset seek position and stop flag
        *self.seek_position.lock().unwrap() = None;
        self.should_stop.store(false, Ordering::Relaxed);

        // Start playback thread
        let file_path = file_path.to_string();
        let state = Arc::clone(&self.state);
        let should_stop = Arc::clone(&self.should_stop);
        let seek_position = Arc::clone(&self.seek_position);
        let volume = Arc::clone(&self.volume);

        let handle = thread::spawn(move || {
            if let Err(e) = Self::play_file_thread(file_path, state, should_stop, seek_position, volume) {
                eprintln!("Playback error: {}", e);
            }
        });

        self.player_thread = Some(handle);

        Ok(duration)
    }

    fn play_file_thread(
        file_path: String,
        state: Arc<Mutex<PlayerState>>,
        should_stop: Arc<AtomicBool>,
        seek_position: Arc<Mutex<Option<f64>>>,
        volume: Arc<Mutex<f32>>,
    ) -> Result<(), String> {
        // Open the file
        let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let media_source = MediaSourceStream::new(Box::new(file), Default::default());

        // Create a probe hint using the file's extension
        let mut hint = Hint::new();
        if let Some(extension) = Path::new(&file_path).extension() {
            if let Some(ext_str) = extension.to_str() {
                hint.with_extension(ext_str);
            }
        }

        // Use the default options for metadata and format
        let meta_opts: MetadataOptions = Default::default();
        let fmt_opts: FormatOptions = Default::default();

        // Probe the media source
        let probed = symphonia::default::get_probe()
            .format(&hint, media_source, &fmt_opts, &meta_opts)
            .map_err(|e| format!("Unsupported format: {}", e))?;

        let mut format = probed.format;

        // Find the first audio track
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No supported audio tracks")?;

        let track_id = track.id;

        // Create a decoder for the track
        let dec_opts: DecoderOptions = Default::default();
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &dec_opts)
            .map_err(|e| format!("Unsupported codec: {}", e))?;

        // Get the audio output device
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("Failed to get default output device")?;

        // Create audio stream
        Self::create_audio_stream(
            device,
            &mut format,
            &mut decoder,
            track_id,
            state,
            should_stop,
            seek_position,
            volume,
        )
    }

    fn create_audio_stream(
        device: Device,
        format: &mut Box<dyn FormatReader>,
        decoder: &mut Box<dyn Decoder>,
        track_id: u32,
        state: Arc<Mutex<PlayerState>>,
        should_stop: Arc<AtomicBool>,
        seek_position: Arc<Mutex<Option<f64>>>,
        volume: Arc<Mutex<f32>>,
    ) -> Result<(), String> {
        let config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;

        let sample_rate = config.sample_rate().0 as f32;
        let channels = config.channels() as usize;

        // Create a ring buffer for audio data
        let ring_buffer = HeapRb::<f32>::new(sample_rate as usize * channels * 2); // 2 seconds buffer
        let (mut producer, mut consumer) = ring_buffer.split();

        // Clone for the audio thread
        let state_clone = Arc::clone(&state);
        let _should_stop_clone = Arc::clone(&should_stop);
        let _seek_position_clone = Arc::clone(&seek_position);
        let volume_clone = Arc::clone(&volume);

        // Start audio output stream
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device
                .build_output_stream(
                    &config.into(),
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        let vol = *volume_clone.lock().unwrap();
                        // Inline audio callback to avoid generic type issues
                        let available = consumer.len();
                        let needed = data.len();

                        if available >= needed {
                            // Read from ring buffer
                            for sample in data.iter_mut() {
                                if let Some(audio_sample) = consumer.pop() {
                                    *sample = audio_sample * vol;
                                } else {
                                    *sample = 0.0;
                                }
                            }
                        } else {
                            // Not enough data, fill with silence
                            data.fill(0.0);
                        }
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
                .map_err(|e| format!("Failed to build output stream: {}", e))?,
            _ => return Err("Unsupported sample format".to_string()),
        };

        stream.play().map_err(|e| format!("Failed to play stream: {}", e))?;

        // Decode and feed audio data
        let _start_time = Instant::now();
        let mut frames_decoded = 0u64;

        loop {
            if should_stop.load(Ordering::Relaxed) {
                break;
            }

            // Check for seek request
            if let Some(seek_pos) = seek_position.lock().unwrap().take() {
                if Self::seek_to_position(format, decoder, track_id, seek_pos).is_ok() {
                    // Update state and reset timing
                    {
                        let mut state = state.lock().unwrap();
                        state.current_time = seek_pos;
                    }
                    frames_decoded = (seek_pos * sample_rate as f64) as u64;
                }
            }

            // Check if paused
            if state.lock().unwrap().is_paused {
                thread::sleep(Duration::from_millis(10));
                continue;
            }

            // Decode the next packet
            match format.next_packet() {
                Ok(packet) => {
                    if packet.track_id() != track_id {
                        continue;
                    }

                    match decoder.decode(&packet) {
                        Ok(audio_buf) => {
                            // Convert to f32 and push to ring buffer - inlined to avoid generics
                            match &audio_buf {
                                AudioBufferRef::F32(buf) => {
                                    // Interleave channels
                                    for frame in 0..buf.frames() {
                                        for ch in 0..buf.spec().channels.count() {
                                            if let Some(sample) = buf.chan(ch).get(frame) {
                                                let _ = producer.push(*sample);
                                            }
                                        }
                                    }
                                }
                                AudioBufferRef::S32(buf) => {
                                    for frame in 0..buf.frames() {
                                        for ch in 0..buf.spec().channels.count() {
                                            if let Some(sample) = buf.chan(ch).get(frame) {
                                                let f32_sample = *sample as f32 / i32::MAX as f32;
                                                let _ = producer.push(f32_sample);
                                            }
                                        }
                                    }
                                }
                                AudioBufferRef::S16(buf) => {
                                    for frame in 0..buf.frames() {
                                        for ch in 0..buf.spec().channels.count() {
                                            if let Some(sample) = buf.chan(ch).get(frame) {
                                                let f32_sample = *sample as f32 / i16::MAX as f32;
                                                let _ = producer.push(f32_sample);
                                            }
                                        }
                                    }
                                }
                                _ => {
                                    // Handle other formats if needed
                                    eprintln!("Unsupported audio buffer format");
                                }
                            }
                            frames_decoded += audio_buf.frames() as u64;

                            // Update current time
                            let current_time = frames_decoded as f64 / sample_rate as f64;
                            state.lock().unwrap().current_time = current_time;
                        }
                        Err(Error::DecodeError(err)) => {
                            eprintln!("Decode error: {}", err);
                            continue;
                        }
                        Err(err) => {
                            eprintln!("Decoder error: {}", err);
                            break;
                        }
                    }
                }
                Err(Error::ResetRequired) => {
                    // Format changed, need to reset decoder
                    break;
                }
                Err(Error::IoError(err)) => {
                    if err.kind() == std::io::ErrorKind::UnexpectedEof {
                        // End of stream
                        break;
                    }
                    eprintln!("I/O error: {}", err);
                    break;
                }
                Err(err) => {
                    eprintln!("Format error: {}", err);
                    break;
                }
            }

            // Small sleep to prevent busy waiting
            thread::sleep(Duration::from_millis(1));
        }

        // Update state when finished
        {
            let mut state = state_clone.lock().unwrap();
            state.is_playing = false;
            state.is_paused = false;
        }

        drop(stream);
        Ok(())
    }


    fn seek_to_position(
        format: &mut Box<dyn FormatReader>,
        decoder: &mut Box<dyn Decoder>,
        track_id: u32,
        position: f64,
    ) -> Result<(), String> {
        // Get the track to determine time base
        let _track = format
            .tracks()
            .iter()
            .find(|t| t.id == track_id)
            .ok_or("Track not found")?;

        // Calculate the seek time in seconds
        let seek_time = Time::new(position as u64, position.fract());

        // Perform the seek
        format
            .seek(SeekMode::Accurate, SeekTo::Time { time: seek_time, track_id: Some(track_id) })
            .map_err(|e| format!("Seek failed: {}", e))?;

        // Reset the decoder
        decoder.reset();

        Ok(())
    }

    pub fn pause(&mut self) {
        let mut state = self.state.lock().unwrap();
        state.is_paused = true;
    }

    pub fn resume(&mut self) {
        let mut state = self.state.lock().unwrap();
        state.is_paused = false;
    }

    pub fn stop(&mut self) {
        self.should_stop.store(true, Ordering::Relaxed);
        
        if let Some(handle) = self.player_thread.take() {
            let _ = handle.join();
        }

        let mut state = self.state.lock().unwrap();
        state.is_playing = false;
        state.is_paused = false;
        state.current_time = 0.0;
        state.file_path = None;
    }

    pub fn seek(&self, position: f32) -> Result<(), String> {
        *self.seek_position.lock().unwrap() = Some(position as f64);
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) {
        *self.volume.lock().unwrap() = volume.clamp(0.0, 2.0);
        let mut state = self.state.lock().unwrap();
        state.volume = volume;
    }

    pub fn get_current_time(&self) -> f32 {
        self.state.lock().unwrap().current_time as f32
    }

    pub fn get_duration(&self) -> f32 {
        self.state.lock().unwrap().duration as f32
    }

    pub fn is_playing(&self) -> bool {
        let state = self.state.lock().unwrap();
        state.is_playing && !state.is_paused
    }

    pub fn get_track_metadata(path: &str) -> Result<TrackMetadata, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(extension) = Path::new(path).extension() {
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
        let mut metadata = probed.metadata;

        // Find the audio track
        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or("No suitable audio track found")?;

        let mut meta = TrackMetadata {
            title: None,
            artist: None,
            album: None,
            track_number: None,
            year: None,
            genre: None,
            duration: 0.0,
            codec: track.codec_params.codec.to_string().into(),
            sample_rate: track.codec_params.sample_rate,
            channels: track.codec_params.channels.map(|c| c.to_string()),
            bits_per_sample: track.codec_params.bits_per_sample,
            has_artwork: false,
        };

        // Calculate duration
        if let (Some(n_frames), Some(sample_rate)) = (track.codec_params.n_frames, track.codec_params.sample_rate) {
            meta.duration = n_frames as f64 / sample_rate as f64;
        }

        // Extract metadata
        if let Some(metadata) = metadata.get() {
            if let Some(metadata_rev) = metadata.current() {
            for tag in metadata_rev.tags() {
                match tag.std_key {
                    Some(StandardTagKey::TrackTitle) => meta.title = Some(tag.value.to_string()),
                    Some(StandardTagKey::Artist) => meta.artist = Some(tag.value.to_string()),
                    Some(StandardTagKey::Album) => meta.album = Some(tag.value.to_string()),
                    Some(StandardTagKey::TrackNumber) => {
                        meta.track_number = tag.value.to_string().parse().ok()
                    }
                    Some(StandardTagKey::Date) => {
                        meta.year = tag.value.to_string().parse().ok()
                    }
                    Some(StandardTagKey::Genre) => meta.genre = Some(tag.value.to_string()),
                    _ => {}
                }
            }

            // Check for artwork
            meta.has_artwork = !metadata_rev.visuals().is_empty();
            }
        }

        Ok(meta)
    }

    pub fn get_album_artwork(path: &str) -> Result<Option<AlbumArtwork>, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(extension) = Path::new(path).extension() {
            if let Some(ext_str) = extension.to_str() {
                hint.with_extension(ext_str);
            }
        }

        let meta_opts: MetadataOptions = Default::default();
        let fmt_opts: FormatOptions = Default::default();

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &fmt_opts, &meta_opts)
            .map_err(|e| format!("Failed to probe format: {}", e))?;

        let mut metadata = probed.metadata;

        if let Some(metadata) = metadata.get() {
            if let Some(metadata_rev) = metadata.current() {
            if let Some(visual) = metadata_rev.visuals().first() {
                use base64::{Engine as _, engine::general_purpose};
                let artwork = AlbumArtwork {
                    data: general_purpose::STANDARD.encode(&visual.data),
                    mime_type: visual.media_type.clone(),
                };
                return Ok(Some(artwork));
            }
            }
        }

        Ok(None)
    }

    // Equalizer methods (stub for now)
    pub fn set_equalizer_band(&self, _frequency: u32, _gain: f32) -> Result<(), String> {
        // TODO: Implement equalizer
        Ok(())
    }

    pub fn set_equalizer_preset(&self, _gains: Vec<f32>) -> Result<(), String> {
        // TODO: Implement equalizer
        Ok(())
    }

    pub fn enable_equalizer(&self, _enabled: bool) -> Result<(), String> {
        // TODO: Implement equalizer
        Ok(())
    }
}
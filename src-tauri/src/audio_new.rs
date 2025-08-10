use crate::symphonia_player::SymphoniaPlayer;

pub use crate::symphonia_player::{TrackMetadata, AlbumArtwork};

pub struct AudioPlayer {
    player: SymphoniaPlayer,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, String> {
        let player = SymphoniaPlayer::new()?;
        
        Ok(AudioPlayer { player })
    }

    pub fn play(&mut self, file_path: &str) -> Result<f32, String> {
        self.player.play(file_path)
    }

    pub fn pause(&mut self) {
        self.player.pause();
    }

    pub fn resume(&mut self) {
        self.player.resume();
    }

    pub fn stop(&mut self) {
        self.player.stop();
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.player.set_volume(volume);
    }

    pub fn seek(&self, position: f32) -> Result<(), String> {
        self.player.seek(position)
    }

    pub fn get_current_time(&self) -> f32 {
        self.player.get_current_time()
    }

    pub fn get_duration(&self) -> f32 {
        self.player.get_duration()
    }

    pub fn is_playing(&self) -> bool {
        self.player.is_playing()
    }

    pub fn get_track_metadata(path: &str) -> Result<TrackMetadata, String> {
        SymphoniaPlayer::get_track_metadata(path)
    }

    pub fn get_album_artwork(path: &str) -> Result<Option<AlbumArtwork>, String> {
        SymphoniaPlayer::get_album_artwork(path)
    }

    // Equalizer stubs for compatibility
    pub fn set_equalizer_band(&self, frequency: u32, gain: f32) -> Result<(), String> {
        self.player.set_equalizer_band(frequency, gain)
    }

    pub fn set_equalizer_preset(&self, gains: Vec<f32>) -> Result<(), String> {
        self.player.set_equalizer_preset(gains)
    }

    pub fn enable_equalizer(&self, enabled: bool) -> Result<(), String> {
        self.player.enable_equalizer(enabled)
    }
}
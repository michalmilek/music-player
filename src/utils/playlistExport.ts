import { Song } from "../types/music";

/**
 * Generate M3U playlist format
 * Format:
 * #EXTM3U
 * #EXTINF:duration,Artist - Title
 * /path/to/file.mp3
 */
export function generateM3U(songs: Song[]): string {
  let content = "#EXTM3U\n";
  
  for (const song of songs) {
    const duration = song.metadata?.duration ? Math.floor(song.metadata.duration) : -1;
    const artist = song.metadata?.artist || "Unknown Artist";
    const title = song.metadata?.title || song.name;
    
    content += `#EXTINF:${duration},${artist} - ${title}\n`;
    content += `${song.path}\n`;
  }
  
  return content;
}

/**
 * Generate PLS playlist format
 * Format:
 * [playlist]
 * File1=/path/to/file.mp3
 * Title1=Artist - Title
 * Length1=duration
 * NumberOfEntries=n
 * Version=2
 */
export function generatePLS(songs: Song[]): string {
  let content = "[playlist]\n";
  
  songs.forEach((song, index) => {
    const num = index + 1;
    const duration = song.metadata?.duration ? Math.floor(song.metadata.duration) : -1;
    const artist = song.metadata?.artist || "Unknown Artist";
    const title = song.metadata?.title || song.name;
    
    content += `File${num}=${song.path}\n`;
    content += `Title${num}=${artist} - ${title}\n`;
    content += `Length${num}=${duration}\n`;
  });
  
  content += `NumberOfEntries=${songs.length}\n`;
  content += "Version=2\n";
  
  return content;
}

/**
 * Generate XSPF (XML Shareable Playlist Format)
 * More modern and comprehensive format
 */
export function generateXSPF(songs: Song[]): string {
  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
  content += '<playlist version="1" xmlns="http://xspf.org/ns/0/">\n';
  content += '  <trackList>\n';
  
  for (const song of songs) {
    content += '    <track>\n';
    content += `      <location>file://${escapeXml(song.path)}</location>\n`;
    
    if (song.metadata?.title) {
      content += `      <title>${escapeXml(song.metadata.title)}</title>\n`;
    }
    
    if (song.metadata?.artist) {
      content += `      <creator>${escapeXml(song.metadata.artist)}</creator>\n`;
    }
    
    if (song.metadata?.album) {
      content += `      <album>${escapeXml(song.metadata.album)}</album>\n`;
    }
    
    if (song.metadata?.duration) {
      const durationMs = Math.floor(song.metadata.duration * 1000);
      content += `      <duration>${durationMs}</duration>\n`;
    }
    
    if (song.metadata?.track_number) {
      content += `      <trackNum>${song.metadata.track_number}</trackNum>\n`;
    }
    
    content += '    </track>\n';
  }
  
  content += '  </trackList>\n';
  content += '</playlist>\n';
  
  return content;
}

/**
 * Generate a simple text playlist
 */
export function generateTXT(songs: Song[]): string {
  let content = "Music Playlist\n";
  content += "==============\n\n";
  
  songs.forEach((song, index) => {
    const num = index + 1;
    const artist = song.metadata?.artist || "Unknown Artist";
    const title = song.metadata?.title || song.name;
    const album = song.metadata?.album || "";
    const duration = song.metadata?.duration 
      ? `${Math.floor(song.metadata.duration / 60)}:${(Math.floor(song.metadata.duration % 60)).toString().padStart(2, '0')}`
      : "";
    
    content += `${num}. ${artist} - ${title}`;
    if (album) content += ` (${album})`;
    if (duration) content += ` [${duration}]`;
    content += `\n   ${song.path}\n\n`;
  });
  
  return content;
}
# 🎵 Tauri Music Player

Odtwarzacz muzyczny zbudowany w Tauri z React, TypeScript, Tailwind CSS i shadcn/ui.

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Rust](https://img.shields.io/badge/Rust-1.70+-orange)

## ✨ Funkcje

- 🎶 **Obsługa wielu formatów audio**: MP3, WAV, FLAC, OGG, M4A
- ⏯️ **Podstawowe kontrolki**: Play, Pause, Next, Previous, Stop
- 🔊 **Kontrola głośności**: Regulacja poziomu dźwięku
- 📋 **Zarządzanie playlistą**: Dodawanie i odtwarzanie wielu utworów
- ⏱️ **Wyświetlanie czasu**: Aktualny czas i całkowity czas trwania
- 📊 **Pasek postępu**: Wizualne wyświetlanie postępu odtwarzania
- 🎨 **Nowoczesny UI**: Elegancki interfejs z Tailwind CSS i shadcn/ui
- 🌙 **Dark mode ready**: Wsparcie dla ciemnego motywu

## 🚀 Rozpoczęcie pracy

### Wymagania

- **Node.js** 18+ 
- **Rust** 1.70+
- **Linux**: `libasound2-dev`, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` oraz inne biblioteki GTK
- **macOS**: Brak dodatkowych wymagań
- **Windows**: WebView2

### Instalacja zależności systemowych (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libglib2.0-dev \
    libgdk-pixbuf-2.0-dev \
    libatk1.0-dev \
    libpango1.0-dev \
    libcairo2-dev \
    libasound2-dev
```

### Uruchomienie projektu

1. **Sklonuj repozytorium**
```bash
git clone <repository-url>
cd tauri-music-player
```

2. **Zainstaluj zależności Node.js**
```bash
npm install
```

3. **Uruchom w trybie deweloperskim**
```bash
npm run tauri dev
```

4. **Zbuduj wersję produkcyjną**
```bash
npm run tauri build
```

## 🏗️ Architektura

### Frontend (React + TypeScript)
- **React 18** z hooks dla zarządzania stanem
- **TypeScript** dla bezpieczeństwa typów
- **Tailwind CSS** dla stylizacji
- **shadcn/ui** dla komponentów UI
- **Lucide React** dla ikon

### Backend (Rust)
- **Tauri 2.0** dla integracji desktop
- **Rodio** dla odtwarzania audio
- **Symphonia** dla metadanych i dekodowania audio
- **Multi-threaded audio engine** z komunikacją przez kanały

### Struktura plików
```
├── src/                    # Frontend React
│   ├── App.tsx            # Główny komponent aplikacji
│   ├── main.tsx           # Entry point
│   ├── globals.css        # Style globalne
│   └── lib/
│       └── utils.ts       # Utility functions
├── src-tauri/             # Backend Rust
│   ├── src/
│   │   ├── lib.rs         # Główny moduł Tauri
│   │   └── audio.rs       # Moduł audio engine
│   ├── Cargo.toml         # Zależności Rust
│   └── capabilities/      # Uprawnienia Tauri
├── components.json        # Konfiguracja shadcn/ui
└── tailwind.config.js     # Konfiguracja Tailwind
```

## 🎯 Funkcjonalności

### ✅ Zaimplementowane
- [x] Odtwarzanie plików audio (MP3, WAV, FLAC, OGG, M4A)
- [x] Kontrolki odtwarzania (play, pause, stop, next, previous)
- [x] Kontrola głośności
- [x] Zarządzanie playlistą
- [x] Wyświetlanie czasu trwania i aktualnego czasu
- [x] Przeglądarka plików do dodawania muzyki
- [x] Responsywny interfejs użytkownika
- [x] Pasek postępu (tylko do wyświetlania)

### 🚧 W planach
- [ ] Prawdziwe przewijanie (seeking) w utworach
- [ ] Wyświetlanie metadanych (tytuł, artysta, album)
- [ ] Obsługa okładek albumów
- [ ] Zapisywanie playlist
- [ ] Equalizer
- [ ] Skróty klawiszowe
- [ ] Mini-player mode
- [ ] Import biblioteki muzycznej

## 🛠️ Rozwój

### Dostępne skrypty

```bash
# Uruchomienie w trybie deweloperskim
npm run tauri dev

# Budowanie wersji produkcyjnej
npm run tauri build

# Linting kodu (jeśli skonfigurowane)
npm run lint

# Formatowanie kodu (jeśli skonfigurowane)
npm run format
```

### Dodawanie nowych funkcji

1. **Frontend**: Edytuj pliki w katalogu `src/`
2. **Backend**: Dodaj nowe komendy Tauri w `src-tauri/src/lib.rs`
3. **Audio**: Rozszerz funkcjonalność w `src-tauri/src/audio.rs`

## 📝 Licencja

Ten projekt jest na licencji MIT - zobacz plik [LICENSE](LICENSE) dla szczegółów.

## 🙏 Biblioteki

- [Tauri](https://tauri.app/) - Framework do aplikacji desktop
- [Rodio](https://github.com/RustAudio/rodio) - Biblioteka audio dla Rust
- [Symphonia](https://github.com/pdeljanov/Symphonia) - Dekoder audio dla Rust
- [shadcn/ui](https://ui.shadcn.com/) - Komponenty UI
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Lucide](https://lucide.dev/) - Ikony

# FFmpeg Setup for Windows

FFmpeg is required for audio streaming. Here are the easiest ways to install it on Windows:

## Option 1: Download Pre-built Binaries (Recommended - Easiest)

1. **Download FFmpeg for Windows:**
   - Visit: https://www.gyan.dev/ffmpeg/builds/
   - Download: `ffmpeg-release-essentials.zip` (or latest version)
   - Extract to: `C:\ffmpeg` (or any location you prefer)

2. **Add to PATH:**
   - Open System Properties → Environment Variables
   - Edit "Path" in System Variables
   - Add: `C:\ffmpeg\bin` (or wherever you extracted it)
   - Click OK on all dialogs

3. **Verify Installation:**
   ```bash
   ffmpeg -version
   ```

## Option 2: Using Chocolatey (If you have it)

```bash
choco install ffmpeg
```

## Option 3: Using Scoop (If you have it)

```bash
scoop install ffmpeg
```

## Option 4: Build from Source (Advanced)

The `ffmpeg` folder has been cloned. To build it on Windows, you need:

1. **MSYS2** - https://www.msys2.org/
2. **Visual Studio** with C++ tools
3. Follow the build instructions in `ffmpeg/README.md`

**Note:** Building from source is complex and time-consuming. Pre-built binaries are recommended.

## Verify FFmpeg Works

After installation, restart your terminal and run:
```bash
ffmpeg -version
```

You should see FFmpeg version information. If you see "command not found", FFmpeg is not in your PATH.

## Troubleshooting

If you get `spawn ffmpeg ENOENT` error:
- FFmpeg is not installed or not in PATH
- Restart your terminal/IDE after adding to PATH
- Verify with `ffmpeg -version` command


# UDAAN Website — Setup Checklist

This file summarizes steps and required assets to run the site locally.

## Prerequisites
- Node.js 18+ recommended (nvm recommended for version management).
- npm (comes with Node.js).

## Quick Setup (Recommended)

### Mac/Linux
Double-click `admin/mac/Setup.command` — this will:
- Verify Node.js and npm are installed
- Create `.env` file with default Supabase configuration
- Create `public/config.json` if missing
- Install all dependencies
- Verify all required assets
- Optionally start the development server

### Windows
Double-click `admin/win/Setup.bat` — same as above for Windows.

## Manual Setup

### Install dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://vdeacxzqdbulgklfkqfs.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional: Gemini API Key for AI features
# GEMINI_API_KEY=your_gemini_api_key
```

### Start dev server
```bash
npm run dev
# open http://localhost:3000
```

## Required public assets (place inside `public/`):
- `Click.wav` — click sound for interactive buttons
- `Reject.wav` — sound when actions are blocked (registration/induction closed)
- `hayden-folker-surrounded.mp3` — background music (auto-enabled by default)
- `uploads-files-3193264-drone+2+model.glb` — drone 3D model
- `RC.glb` — RC plane 3D model
- `udaan-logo.webp` — site logo
- `nitr-logo.svg` — NITR logo
- `config.json` — app configuration (created automatically by setup script)

## Admin Controls
Located in `/admin` folder:
- `Toggle-Registration.command/.bat` — Toggle event registration on/off
- `Toggle-Induction-1stYear.command/.bat` — Toggle 1st year induction on/off
- `Toggle-Induction-2ndYear.command/.bat` — Toggle 2nd year induction on/off

## Database Setup
See `db/README.md` for Supabase database setup instructions.

## Notes

### Autoplay & Browser Policy
- Modern browsers often block autoplay of audio until the user interacts with the page. Background music is enabled by default in the app and will start after user interaction where required.

### Port
- The project runs at `http://localhost:3000` in development. If the port is already in use, Vite will suggest another port.

### Troubleshooting
- If `npm install` fails, try deleting `node_modules/` and `package-lock.json` and re-run `npm install`.
- If audio does not play, ensure the files exist and the browser isn't blocking audio autoplay (look in the console for errors).
- If you see "Missing Supabase key" errors, ensure your `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set.

### Default Admin Login
- ID: `UDAAN-001`
- Password: `admin123`

### Contact
- If you need help adding assets or testing, ping Nirav (project owner).

<div align="center">

# ✈️ UDAAN Aeromodelling Club

### NIT Rourkela's Premier Aeromodelling Club

[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**Team Portal • Event Registration • Member Management**

</div>

---

# UDAAN Aeromodelling Club Website

Official website for UDAAN - NIT Rourkela's premier aeromodelling club.

## Quick Setup (Recommended)

### Windows
Double-click `admin/win/Setup.bat` to automatically install everything!

### macOS/Linux
Double-click `admin/mac/Setup.command` to automatically install everything!

If it doesn't run on macOS/Linux, make it executable first:
```bash
chmod +x admin/mac/Setup.command
./admin/mac/Setup.command
```

## Manual Setup

**Prerequisites:** Node.js (v18 or higher recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 in your browser

## Build for Production

```bash
npm run build
npm run preview
```

## Admin Controls

Toggle scripts are located in the `/admin` folder, organized by platform:

### Windows (`admin/win/`)
- **Setup.bat** - One-click project setup
- **Toggle-Induction.bat** - Toggle Join Corps (inductions) on/off
- **Toggle-Registration.bat** - Toggle Event Registration on/off

### macOS/Linux (`admin/mac/`)
- **Setup.command** - One-click project setup
- **Toggle-Induction.command** - Toggle Join Corps (inductions) on/off
- **Toggle-Registration.command** - Toggle Event Registration on/off

If scripts don't run on macOS/Linux, make them executable:
```bash
chmod +x admin/mac/*.command
```

### How it works
The toggle scripts modify `/public/config.json` which controls whether:
- **Join Corps** button shows the registration page or a "not inducting" message
- **Register** buttons show the event registration page or a "registrations closed" message

Default state: Both inductions and registrations are **closed**.

## Project Structure

```
├── admin/                  # Admin scripts
│   ├── mac/                # macOS/Linux scripts
│   │   ├── Setup.command
│   │   ├── Toggle-Induction.command
│   │   └── Toggle-Registration.command
│   └── win/                # Windows scripts
│       ├── Setup.bat
│       ├── Toggle-Induction.bat
│       └── Toggle-Registration.bat
├── components/             # React components
├── pages/                  # Page components (JoinCorps, Register)
├── public/                 # Static assets & config
│   └── config.json         # Induction/Registration status
├── App.tsx                 # Main application
└── index.tsx               # Entry point
```


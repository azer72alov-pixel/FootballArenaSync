# ArenaSync - Sports Facility Booking Platform

ArenaSync is a modern, mobile-first web application for booking sports facilities (specifically football courts) in Sumqayit. It features real-time availability, subscription management, and an admin dashboard.

## Features

- **User Booking:** Browse courts, view details, select dates/times, and book slots.
- **Subscriptions:** Monthly subscription plans for regular teams.
- **Admin Dashboard:** Manage bookings, view revenue stats, manual booking entry, and PIN security.
- **Multilingual:** Support for AZ, RU, and EN languages.
- **Responsive Design:** Optimized for mobile (Telegram Web App compatible) and desktop.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase (Database & Realtime) / Local Mock Mode

## Getting Started

1.  **Clone or Download** the repository.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
4.  **Build for Production:**
    ```bash
    npm run build
    ```

## Admin Access

To access the Admin Panel, click "Partner Access" (or "Admin Panel" in the footer) and enter the PIN for the specific facility.

**Default PINs:**
- Sumqayıt Paralimpiya Kompleksi: `1001`
- Sumqayıt Olimpiya İdman Kompleksi: `1002`
- Azfar Futbol Meydançası: `1003`

## Deployment

This project is ready for deployment on platforms like Vercel, Netlify, or GitHub Pages.

- **Vercel:** Connect your GitHub repository and Vercel will auto-detect Vite settings.

# 🍺 City of Ale — Norwich Pub Crawl Tracker

Track, score and crawl every pub in Norwich. A crowd-sourced pub rating app with community scores, personal notes, map view and crawl planning.

## Live Site
[cityofale.com](https://cityofale.com)

## Features
- 125 Norwich pubs across all city areas
- Community-averaged scores across 10 categories
- Personal notes, visit tracking and tags (private per user)
- Interactive map with all pubs plotted
- Pub crawl route planner with themes and area filters
- Progress tracking and stats
- Full auth via Supabase (sign up / sign in / password reset)
- Cloud sync — access your data from any device

## Tech Stack
- Pure HTML/CSS/JS — no build step needed
- [Supabase](https://supabase.com) — auth, database, row-level security
- [Leaflet.js](https://leafletjs.com) — interactive map
- Hosted on [Vercel](https://vercel.com)

## Database Schema
Three tables in Supabase:
- `pub_visits` — private per user (visited status, notes, tags)
- `pub_scores` — shared scores per user per pub (community averaged)
- `user_profiles` — display names

## Deployment
This repo deploys automatically to Vercel on every push to `main`.

## Local Development
Just open `index.html` in a browser — no build step, no dependencies to install.

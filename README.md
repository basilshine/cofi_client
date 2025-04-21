# Cofilance - Financial Management Application

A modern financial management application built with React, TypeScript, and Vite. The application works both as a Telegram Web App and a standalone website.

## Features

- Authentication (Telegram Web App & Regular)
- Expense Management
  - Add new expenses
  - View recent expenses
  - Category statistics
  - Monthly summaries
  - Recurring expenses setup
- Analytics
  - Expense trends
  - Category breakdown
  - Monthly comparisons

## Tech Stack

- React 18
- TypeScript
- Vite
- Mantine UI
- Zustand (State Management)
- React Router
- Telegram Web App SDK
- Biome (Linting & Formatting)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── features/       # Feature-specific components and logic
├── hooks/          # Custom React hooks
├── layouts/        # Layout components
├── pages/          # Page components
├── services/       # API services
├── store/          # State management
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Development

- Run the development server: `npm run dev`
- Lint code: `npm run lint`
- Format code: `npm run format`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## License

ISC

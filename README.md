# Earthbound AI Dashboards

## Prerequisites

- Node.js v14 or higher (recommended v16+)
- npm, yarn, or pnpm

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/apps-dashboards.git
   cd apps-dashboards
   ```

2. Install dependencies:

   Using npm:
   ```bash
   npm install
   ```

   Using pnpm:
   ```bash
   pnpm install
   ```

   Using yarn:
   ```bash
   yarn install
   ```

## Running the Application

Start the development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Once the server is running, open your browser and navigate to:

```
http://localhost:5173
```

## Building for Production

Generate an optimized production build:

```bash
npm run build
# or
pnpm build
# or
yarn build
```

Preview the production build:

```bash
npm run preview
# or
pnpm preview
# or
yarn preview
```

## Linting

Run ESLint to analyze code for potential issues:

```bash
npm run lint
# or
pnpm lint
# or
yarn lint
```

## Folder Structure

```
apps-dashboards/
├── public/               # Static assets (images, icons)
├── src/
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API and data service modules
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root application component
│   └── main.tsx          # Application entry point
├── index.html            # Vite HTML template
├── package.json          # Project metadata and scripts
└── tsconfig.json         # TypeScript configuration
```

## Technologies

- [Vite](https://vitejs.dev/) for build tooling
- [React](https://reactjs.org/) & [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [Mapbox GL](https://docs.mapbox.com/mapbox-gl-js/) for map rendering
- [Zod](https://github.com/colinhacks/zod) for schema validation

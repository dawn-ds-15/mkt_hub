# MKT Hub Frontend

Marketing operations SPA built with React 18, Vite 4, React Router 6 and Tailwind CSS 3.

## Requirements

- Node.js 18 or newer
- npm

## Getting started

```sh
npm ci
npm run dev
```

Set `VITE_API_URL` in a root-level `.env.local` file to configure the backend API. Vite reads environment files from the project root; files inside `src/` are not application environment configuration. Never commit credentials or secrets, and remember that `VITE_` variables are exposed in the browser bundle.

```dotenv
VITE_API_URL=http://localhost:3000/api
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Generate the production application in `dist/` |
| `npm run preview` | Serve the production build locally |

There are currently no configured lint, typecheck or test scripts.

## Project structure

```text
mkt_hub/
├── public/
│   └── templates/           # Static downloadable templates, served without bundling
├── src/
│   ├── app/
│   │   └── App.jsx          # Router, providers, lazy page imports and auth guard
│   ├── components/          # Reusable UI and module-specific components
│   │   ├── common/
│   │   ├── Layout/
│   │   ├── Profiles/
│   │   └── .../
│   ├── contexts/            # React context providers
│   ├── hooks/               # Reusable React hooks
│   ├── mocks/               # Fixtures and existing module configuration constants
│   ├── pages/               # Route-level pages
│   ├── services/            # API client and service-layer stores
│   ├── styles/
│   │   └── index.css        # Tailwind directives and global/theme styles
│   ├── utils/               # Formatting, permissions and other shared utilities
│   └── main.jsx             # React DOM entry point
├── docs/
│   ├── specifications/      # API specifications and backend integration notes
│   └── qa/
│       └── BUG_REPORT.md    # Findings and fix verification
├── index.html               # Vite HTML entry point
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── vercel.json
```

## Conventions

- Put route-level screens in `src/pages/`; compose smaller UI in `src/components/<Module>/`.
- Keep routing and application-wide provider composition in `src/app/App.jsx`.
- Keep backend access in `src/services/api.js`, hooks in `src/hooks/`, and shared non-UI helpers in `src/utils/`.
- Use dashboard context for locale and theme. Global dark-mode styling lives in `src/styles/index.css`.
- Use the existing Tailwind design tokens rather than introducing unrelated colors or typography.
- Preserve UTF-8 encoding when editing Vietnamese text.
- Keep generated output, dependencies, environment files and deployment archives out of source control.
- Run `npm run build` after changes.

## Deployment

The production artifact remains `dist/`. Docker/Nginx and Vercel configuration stay at the repository root. The source-folder reorganization does not change application URLs or API endpoints.

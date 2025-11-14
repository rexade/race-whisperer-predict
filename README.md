# Race Whisperer Predict

A React + TypeScript + Vite application for V75 race analysis, optimized for both mobile and desktop browsers.

## Technologies

This project is built with:

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **React 18** - UI library
- **shadcn-ui** - Component library
- **Tailwind CSS** - Utility-first CSS framework

## Local Development

### Prerequisites

- Node.js 18+ (recommended to install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- npm or yarn

### Setup

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd race-whisperer-predict

# Step 3: Install dependencies
npm install

# Step 4: Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Deployment

This project is configured to deploy on multiple platforms. Choose the one that works best for you:

### Option 1: Vercel (Recommended - Easiest)

Vercel provides the easiest deployment experience with automatic HTTPS and mobile optimization.

1. **Install Vercel CLI** (optional):
   ```sh
   npm i -g vercel
   ```

2. **Deploy**:
   - **Via CLI**: Run `vercel` in the project directory
   - **Via GitHub**: 
     - Push your code to GitHub
     - Go to [vercel.com](https://vercel.com)
     - Click "New Project"
     - Import your GitHub repository
     - Vercel will auto-detect the Vite configuration
     - Click "Deploy"

3. **Custom Domain**: Add your domain in Vercel project settings

The `vercel.json` file is already configured with the correct settings.

### Option 2: Netlify

Netlify offers excellent static site hosting with continuous deployment.

1. **Via CLI**:
   ```sh
   # Install Netlify CLI
   npm i -g netlify-cli
   
   # Build the project
   npm run build
   
   # Deploy
   netlify deploy --prod
   ```

2. **Via GitHub**:
   - Push your code to GitHub
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Connect your GitHub repository
   - Build settings are auto-detected from `netlify.toml`
   - Click "Deploy site"

3. **Custom Domain**: Add your domain in Netlify site settings > Domain management

The `netlify.toml` file is already configured with the correct settings.

### Option 3: GitHub Pages

Free hosting directly from your GitHub repository.

1. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Select source: "GitHub Actions"

2. **Deploy**:
   - Push your code to the `main` or `master` branch
   - The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically build and deploy
   - Your site will be available at: `https://<username>.github.io/<repository-name>`

3. **Update base path** (if needed):
   - If your repository name is not the root, update `vite.config.ts` to include:
     ```ts
     export default defineConfig({
       base: '/<repository-name>/',
       // ... rest of config
     })
     ```

### Mobile Optimization

This app is already configured for mobile devices with:
- Responsive viewport meta tags
- Touch-friendly interface
- Apple mobile web app support
- Progressive Web App capabilities (can be enhanced further)

All deployment platforms support mobile access out of the box.

## Building for Production

```sh
npm run build
```

The production build will be in the `dist` directory, ready to be deployed to any static hosting service.

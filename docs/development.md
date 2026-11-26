# Development and hosting

[Back to the README](../README.md)

## Local development

Use Node **22** (also specified in [mise.toml](../mise.toml)).

With mise:

```sh
mise install
mise exec -- npm ci
mise exec -- npm run dev -- --host 0.0.0.0
```

Open the displayed localhost address, or the PC's LAN IP on your phone. Direct Web NFC requires a compatible browser and a secure context; GitHub Pages provides HTTPS. The other editing and export features can still be used without Web NFC.

## Build and check the hosted path

```sh
mise exec -- npm run build -- --base /elegoo-rfid-ntag215-editor/
mise exec -- npm run preview -- --host 127.0.0.1 --base /elegoo-rfid-ntag215-editor/
```

Open the displayed preview address; it includes /elegoo-rfid-ntag215-editor/. The normal build uses relative paths; the deployment workflow supplies the Pages base path. App icons and the service worker are included in the production build. Offline use becomes available after a successful initial online visit; online catalogs still require a connection.

Browser integration checks are available at /tests/spoolLibrary.browser.html on the development server. They use an isolated test database, not your spool library.

## GitHub Pages deployment

The workflow in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) installs locked dependencies with Node 22, builds the site and deploys only the generated dist directory.

1. In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source.
2. Commit and push the reviewed changes to main. Fork workflows may need enabling on the **Actions** tab.
3. Check **Actions → Deploy to GitHub Pages**. A successful deployment provides the site URL.

A push to main or a manual workflow run triggers deployment. No server, database service or application secrets are needed. See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Dependency maintenance

Run npm audit to review development-tool dependencies and npm audit --omit=dev to inspect runtime dependencies. Compatible fixes have been applied to the lockfile. Remaining findings require separate build/lint tool upgrades; do not use npm audit fix --force without reviewing and testing those changes.



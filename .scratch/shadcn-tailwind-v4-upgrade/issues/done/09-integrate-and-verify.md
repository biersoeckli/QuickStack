# 09 — Upgrade integrieren und verifizieren

**What to build:** Der gesamte Stack (Tickets 03–08) ist zusammen grün und auslieferbar: Build, Lint,
Tests, Docker/standalone-Image und ein manueller Durchstich durch die wichtigsten Screens.

**Blocked by:** 05 — Kern-Komponenten neu beziehen; 06 — Komplexe Komponenten neu beziehen;
07 — Radix vereinheitlichen; 08 — `cn` migrieren.

**Status:** ready-for-agent

- [ ] `yarn lint`, `yarn build` und `yarn test` sind grün.
- [ ] Das Docker-/standalone-Build erzeugt ein lauffähiges Image (PostCSS v4 wird gefunden).
- [ ] Manueller Durchstich: Dashboard, App-Source-Wizard, Terminal- und Log-Ansichten, Dialoge,
      Sidebar, Command-Palette und Dunkelmodus funktionieren.
- [ ] Suche nach Altmustern ist leer: `@radix-ui/react-`, `clsx`, `tailwind-merge`,
      `tailwindcss-animate`, `style: "default"`, `@tailwind `-Direktiven.
- [ ] Etwaige Restentscheidungen aus früheren Tickets sind hier abgeschlossen oder als Follow-up notiert.

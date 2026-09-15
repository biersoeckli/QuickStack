# 01 — shadcn-Aliase korrigieren

**What to build:** Die `components.json`-Aliase so korrigieren, dass die shadcn-CLI die realen
UI- und Utility-Pfade kennt. Kein Nutzerverhalten ändert sich, aber alle späteren
`shadcn add`/`shadcn migrate`-Läufe schreiben und importieren an die richtigen Stellen.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `aliases.ui` zeigt auf das reale UI-Verzeichnis.
- [ ] `aliases.utils` zeigt auf die reale `cn`-Utility (nicht auf einen leeren Pfad).
- [ ] `npx shadcn@latest info` meldet das korrekte Framework und die korrekten Pfade.
- [ ] Bestehende Imports der UI-Komponenten bleiben unverändert; `yarn lint` und `yarn build` sind grün.

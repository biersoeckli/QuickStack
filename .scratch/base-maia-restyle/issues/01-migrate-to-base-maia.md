# 01 — QuickStack UI auf shadcn `base-maia` umstellen

**Status:** ready-for-agent

**Was:** Bestehende `src/components/ui`-Wrapper (bereits Base UI, aber im Legacy-Style `new-york`) auf den
shadcn-Style `base-maia` umstellen, lokale QuickStack-Anpassungen erhalten, und `components.json`/Preset so
setzen, dass `shadcn add` künftig `base-maia` liefert.

**Nicht verwechseln mit:** der abgeschlossenen Radix->Base-UI-Primitive-Migration (`shadcn-tailwind-v4-upgrade`,
Ticket 10). Die Primitives sind bereits Base UI; hier geht es ausschliesslich um Style/Theme/Klassen.

---

## Problem Statement

Aus Maintainer-Sicht: QuickStack hängt auf dem Legacy-Style `new-york` (Radix-geprägt), obwohl die App seit
der abgeschlossenen Base-UI-Migration technisch auf `@base-ui/react` läuft. Der Look weicht vom aktuellen
shadcn-Standard ab, `components.json` meldet dem CLI weiter `base: radix`, und jedes `shadcn add <component>`
würde Radix-Varianten in das Projekt ziehen und den gerade entfernten Radix-Stack wieder einführen. Es fehlt
ein einheitlicher, zukunftssicherer Style, der zu den bereits migrierten Primitives passt.

Aus Nutzer-Sicht: Die UI soll dem Maia-Look von shadcn entsprechen (runde Buttons, Maia-Farben/Radien/Typo,
konsistente Menüs/Overlays), ohne dass Verhalten, Tastaturbedienung, Fokus oder bestehende QuickStack-Akzente
verloren gehen.

## Solution

Die UI-Wrapper komponentenweise aus der `base-maia`-Registry beziehen und dabei die lokalen QuickStack-
Anpassungen zurückspielen. `components.json` auf `base-maia` umstellen (Preset inkl. Theme/Fonts), damit
Styles künftig konsistent geliefert werden. Nach jeder Komponente ist der Build grün und die Komponente
manuell verifiziert. Es werden keine neuen Abhängigkeiten eingeführt; die Base-UI-Primitives bleiben.

## User Stories

1. Als QuickStack-Maintainer will ich, dass alle UI-Komponenten dem `base-maia`-Style entsprechen, damit die App wie eine aktuelle shadcn-App wirkt.
2. Als QuickStack-Maintainer will ich, dass `components.json` und das Preset auf `base-maia` stehen, damit `shadcn add` künftig Maia-Komponenten statt Radix liefert.
3. Als QuickStack-Entwickler will ich, dass `yarn build` nach jeder migrierten Komponente grün ist, damit die Migration jederzeit auslieferbar bleibt.
4. Als QuickStack-Entwickler will ich pro Komponente einen eigenen Commit, damit die Historie reviewbar bleibt.
5. Als QuickStack-Entwickler will ich die lokalen Anpassungen (u.a. Progress-`color`, Sidebar-Cookie `sidebar:state`, Sheet-Animation, `Item`-`xs`-Variante) erhalten, damit keine QuickStack-Funktion verloren geht.
6. Als QuickStack-Entwickler will ich die `utils`-Utility und den `cn`-Re-Export vor einem Überschreiben durch die `utils`-Registry-Dependency schützen.
7. Als App-Nutzer will ich Maia-Buttons (Pill-Form, Maia-Varianten) sehen, damit die App dem gewünschten Design entspricht.
8. Als App-Nutzer will ich, dass Buttons weiterhin per Tastatur fokussierbar sind und `render`-basierte Links funktionieren, damit Navigation unverändert bleibt.
9. Als App-Nutzer will ich, dass Dialoge/Sheets/Alerts im Maia-Look erscheinen und Fokus korrekt einfangen/zurückgeben.
10. Als App-Nutzer will ich, dass Dropdown-Menüs und Selects korrekt positionieren, mit Pfeiltasten navigierbar sind und Typeahead behalten.
11. Als App-Nutzer will ich, dass Tooltips/Popover/Hover-Cards weiterhin am Trigger ankern und in Maia-Optik erscheinen.
12. Als App-Nutzer will ich, dass die Sidebar (expanded/collapsed/mobile) im Maia-Look funktioniert und Tooltips im collapsed-Zustand öffnen.
13. Als App-Nutzer will ich, dass Formulare (Label, Control, Messages, Validierung) unverändert funktionieren und ARIA-Verdrahtung behalten.
14. Als App-Nutzer will ich Light- und Dark-Mode in den Maia-Farbtokens, damit beide Themes konsistent sind.
15. Als App-Nutzer will ich, dass Tabellen, Badges, Cards und Empty-States dem Maia-Look folgen.
16. Als App-Nutzer will ich, dass Nicht-Radix-Bibliotheken (Drawer/vaul, Command/cmdk, Sonner, Calendar, Chart) unangetastet bleiben und weiter funktionieren.
17. Als QuickStack-Entwickler will ich, dass `data-*`-Hooks, auf die App-Code baut (`data-popup-open`, `data-active`, `data-disabled`, `data-open/closed`), weiter funktionieren oder bewusst migriert werden.
18. Als QuickStack-Entwickler will ich pro migrierter Komponente einen Kurzbericht unter `.migration/base-maia-<component>.md`, damit der Stand aus dem Repo ableitbar ist.
19. Als QuickStack-Entwickler will ich, dass die bereits grünen jsdom-Tests grün bleiben, damit die Migration keine Verhaltensregression einführt.
20. Als QuickStack-Maintainer will ich, dass ein `--all --overwrite` unterbleibt, damit keine Komponente unkontrolliert überschrieben wird.
21. Als QuickStack-Maintainer will ich am Ende, dass `shadcn info` `base` != radix meldet und `style` auf Maia steht.
22. Als Reviewer will ich, dass die Spec klar abgrenzt, was nicht Teil der Migration ist (neue Komponenten, Backend, andere Bases/Styles).

## Implementation Decisions

- **Golden-Pair jetzt echt vorhanden.** Anders als `new-york` hat `base-maia` ein echtes Pendant
  (`https://ui.shadcn.com/r/styles/base-maia/<component>.json`). Deshalb: Wrapper inhaltlich aus der
  `base-maia`-Registry beziehen statt per Transformations-Engine rekonstruieren.
- **Modus:** komponentenweise, nicht `--all`. Pro Komponente: Golden holen, lokale Diffs zurückspielen,
  Build grün, dann nächste Komponente. `--overwrite` nur für bereits geprüfte Einzelkomponenten.
- **Style/Preset:** `components.json` auf `base-maia` setzen. Da `style` nach Init nicht regulär änderbar ist,
  via Preset (`shadcn init --preset base-maia --force` bzw. `apply`-Pfad) oder kontrolliertes Editieren +
  Re-Add. Theme/Farben/Fonts kommen aus dem Preset, nicht aus dem Style-JSON (`base-maia/index.json` hat leere
  `cssVars`).
- **Reihenfolge bottom-up:** zuerst Blatt-Wrapper (button, label, input, textarea, separator, badge, card,
  skeleton, spinner, avatar, progress, checkbox, switch, radio, select, tooltip, popover, hover-card,
  dropdown-menu), dann Kompositionen (dialog, sheet, alert-dialog, sidebar, form, breadcrumb, command, table,
  pagination, column-header/-toggle).
- **Lokale Anpassungen sind bindend.** Quelle: `.scratch/shadcn-tailwind-v4-upgrade/UI-COMPONENT-INVENTORY.md`
  (“Merge carefully” / “Do not overwrite”). Mindestens: Progress-`color`-Prop, Sidebar-Cookie-Name
  `sidebar:state`, Sheet-Animation/Sides, `Item`-`xs`-API, `command`-`shadow-lg`, `drawer` bleibt vaul.
- **`utils` schützen.** `base-maia/index.json` hat `registryDependencies: ["utils"]`; der `aliases.utils`-Pfad
  (`@/frontend/utils/utils`, `cn`-Re-Export) darf nicht überschrieben werden.
- **Call-Sites:** `base-maia` ändert Button-Varianten/Sizes und lässt `data-variant`/`data-size` am Button weg.
  Call-Sites mit alten Größen-/Varianten-Annahmen und `data-[variant=...]`-Hooks prüfen und anpassen.
- **Keine neuen Deps:** `base-maia/index.json` benötigt nur `class-variance-authority`, `cn`, `lucide-react`,
  `@base-ui/react` — alle vorhanden. Icon-Library bleibt `lucide`.
- **Unangetastet:** `drawer` (vaul), `command` (cmdk), `sonner`, `calendar` (react-day-picker), `chart`
  (recharts), `input-otp`.
- **Datenattribute:** bestehende Base-UI-Hooks (`data-open/closed`, `data-popup-open`, `data-active`,
  `data-disabled`) beibehalten; nur migrieren, wo `base-maia` bewusst etwas anderes nutzt.
- **Berichte:** `.migration/base-maia-<component>.md` (gleiches Skelett wie bisherige Migrationsberichte).
  Kein Index; Stand wird aus Disk abgeleitet.

## Testing Decisions

- **Ein automatisierter Seam:** voller Build/Typecheck — `npx tsc --noEmit`, `yarn lint`, `yarn build`
  (`next build` + Server-`tsc` + `tsc-alias`). Kein neuer Runtime-Test-Seam.
- **Guter Test** testet externes Verhalten, nicht Implementierungsdetails: Rollen, Fokus-Rückgabe, Tastatur-
  navigation, Typeahead, Scroll-Lock — keine Klassen-/DOM-Struktur-Asserts.
- **Bestehende jsdom-Tests** (z. B. `server-settings-tabs.unit.spec.ts`, `project-network-graph.spec.ts`,
  `pod-status-indicator.unit.spec.ts`) bleiben der Regressions-Indikator und müssen grün bleiben. Bekannt und
  nicht Teil dieser Spec: 2 vorbestehende Fehlschläge in `server-settings-tabs.unit.spec.ts` aus dem früheren
  Tabs-Commit (`f76e3df`).
- **Manuelles QA pro Komponente** anhand der “Verify by hand”-Checklisten; zusätzlich ein visueller Durchgang
  über die Kernseiten: Sidebar/`nav-bar`, `settings/server`, `settings/users`, `project/app/[appId]`,
  `project/agent/[agentId]`, `monitoring`, Light + Dark.
- Stichproben auf beiden Themes und mobil (`Sheet`-Sidebar).

## Out of Scope

- Erneute Primitive-Migration (bereits Base UI) und Entfernen von Radix (bereits erledigt).
- Andere Bases (`aria`) oder Styles (`nova`, `lyra`, `mira`, `sera`, `vega`, `luma`).
- Neue shadcn-Komponenten, die QuickStack noch nicht nutzt (z. B. Field, Input Group).
- Automatisierte visuelle Regression / Screenshot-Diffs.
- `drawer`, `command`, `sonner`, `calendar`, `chart`, `input-otp`.
- Backend, Server Actions, Kubernetes-Logik.
- Änderungen an Geschäftslogik oder Datenmodell.

## Further Notes

- Belege aus der Recherche:
  - Styles: `nova`, `vega`, `lyra`, `maia`, `mira`, `sera`, `luma` × Bases `base`/`radix`/`aria`
    (alle `<base>-<style>` liefern 200).
  - Neuer App-Default: Style `Nova`; CLI `init --defaults` -> `--preset=base-nova`.
  - `base-maia/index.json`: `dependencies` = `class-variance-authority`, `cn`, `lucide-react`,
    `@base-ui/react`; `cssVars` leer; `css` importiert `tw-animate-css` + `shadcn/tailwind.css`.
  - `base-maia/button`: `rounded-4xl`, Varianten ohne `shadow-xs`, Sizes via `has-data-[icon=...]`,
    kein `data-variant`/`data-size`.
- Risiko: `--overwrite` zerstört lokale Anpassungen -> Inventory als Replay-Checkliste, komponentenweise,
  nach jedem Schritt Build.
- Aktueller Branch-Stand ist grün (tsc/lint/build); Ausgangspunkt ist der Commit der Base-UI-Migration.
- Kein ADR-Konflikt: bestehende ADRs betreffen Network-Policy/Add-ons/Configuration Migrations, nicht UI.

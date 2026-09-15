# shadcn/ui auf Tailwind v4 aktualisieren

## Ziel

QuickStack auf den aktuellen Stand von shadcn/ui bringen (Stand Sep 2026): Tailwind CSS v4,
`new-york`-Style, unified `radix-ui`, `cn`-Package. Kein neues Feature — ein Upgrade, das die
bestehende UI visuell intakt hält.

## Ist-Zustand

- Tailwind v3.4, `tailwind.config.ts`, `@tailwind`-Direktiven, `tailwindcss-animate`.
- `components.json`: `style: "default"` (deprecated), `baseColor: "slate"`, `cssVariables: true`.
- `aliases.utils` zeigt auf einen Pfad, an dem die `cn`-Utility nicht liegt.
- 25 einzelne `@radix-ui/react-*`-Pakete; Icons `lucide-react`; `sonner` bereits aktuell.
- Next 15 + React 19 → bereits kompatibel.

## Entscheidungen

1. **Radix behalten.** shadcn defaultet seit Juli 2026 auf Base UI, aber Radix ist nicht deprecated
   und eine Base-UI-Migration ist explizit optional (Ticket 10, `needs-triage`).
2. **Tailwind v3 → v4 ist ein Big-Bang** (eine PostCSS-Pipeline, ein CSS-Entry). Nicht expand/contract-
   fähig. Tickets 03–08 teilen eine Integrations-Branch; grün wird erst in Ticket 09 zugesichert.
3. **Base-Color** `slate` existiert nicht mehr; Auswahl in Ticket 04 treffen.
4. **Lokale Anpassungen gewinnen.** Nie blind `--all --overwrite`; pro Komponente Diff mergen.
5. **`cn`-Migration erst nach Tailwind v4** — die `cn`-Merge-Engine targetet v4.

## Ticket-Reihenfolge (Frontier)

01 → 02, 03 → 04 → 05, 06 → 07, 08 → 09 → (10 optional)

## Quellen

- https://ui.shadcn.com/docs/tailwind-v4
- https://ui.shadcn.com/docs/cli
- https://ui.shadcn.com/docs/components-json
- https://ui.shadcn.com/docs/changelog (2025-06 radix, 2026-07 base-ui, 2026-09 cn)
- https://tailwindcss.com/docs/upgrade-guide

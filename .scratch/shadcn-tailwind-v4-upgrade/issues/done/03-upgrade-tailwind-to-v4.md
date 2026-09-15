# 03 — Tailwind CSS auf v4 upgraden

**What to build:** Die App baut und rendert auf Tailwind CSS v4, mit visuell intaktem Bestand.
Die JS-Config weicht einer CSS-first-Konfiguration; das Animations-Plugin wird ersetzt.

**Blocked by:** 01 — shadcn-Aliase korrigieren.

**Status:** ready-for-agent

- [ ] Tailwind v4 und `@tailwindcss/postcss` installiert; PostCSS-Config umgestellt.
- [ ] Globales CSS nutzt `@import "tailwindcss"`, Theme-Tokens liegen unter `@theme inline`.
- [ ] Projektspezifische Farben und eigene Utilities sind nach CSS portiert (nicht verloren).
- [ ] `tailwindcss-animate` ist durch `tw-animate-css` ersetzt.
- [ ] Deprecated/umbenannte Utilities sind korrigiert (Schatten/Radius/Ring/Outline/Variablen-Shorthand).
- [ ] Die alte `tailwind.config`-Datei ist entfernt bzw. wird nicht mehr geladen.
- [ ] `yarn lint` und `yarn build` sind grün.
- [ ] Sichtprüfung Hell/Dunkel: Layout und Farben unverändert.

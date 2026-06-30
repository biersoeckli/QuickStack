
#!/usr/bin/env bash
set -euo pipefail

# ── CRD-Liste ──────────────────────────────────────────────
# Format: "group version"
# Gruppe ohne abschließenden Schrägstrich, Version ohne führenden.
CRDS=(
  "agents.x-k8s.io v1beta1"
  "extensions.agents.x-k8s.io v1beta1"
)

OPENAPI_DIR="./src/server/adapter/api-clients/openapi"
TYPES_DIR="./src/server/adapter/api-clients/types"

mkdir -p "$OPENAPI_DIR" "$TYPES_DIR"

for entry in "${CRDS[@]}"; do
  read -r group version <<< "$entry"
  base="${group}-${version}"

  echo "→ Lade OpenAPI-Schema für ${group}/${version} …"
  kubectl get --raw "/openapi/v3/apis/${group}/${version}" \
    | jq . > "${OPENAPI_DIR}/${base}-openapi.json"

  echo "→ Generiere TypeScript-Typen …"
  npx openapi-typescript "${OPENAPI_DIR}/${base}-openapi.json" \
    --output "${TYPES_DIR}/${base}.openapi.ts"

  echo "✓ ${base} fertig"
  echo
done

echo "Alle CRDs aktualisiert."
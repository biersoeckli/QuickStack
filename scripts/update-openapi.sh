
#!/usr/bin/env bash
set -euo pipefail

OPENAPI_DIR="./src/server/adapter/api-clients/openapi"
TYPES_DIR="./src/server/adapter/api-clients/types"

mkdir -p "$OPENAPI_DIR" "$TYPES_DIR"

mapfile -t openapi_files < <(find "$OPENAPI_DIR" -maxdepth 1 -type f -name "*.json" | sort)

if [ "${#openapi_files[@]}" -eq 0 ]; then
  echo "Keine OpenAPI-JSONs in ${OPENAPI_DIR} gefunden." >&2
  exit 1
fi

for input_file in "${openapi_files[@]}"; do
  filename="$(basename "$input_file")"
  base="${filename%.json}"
  base="${base%-openapi}"

  echo "→ Generiere TypeScript-Typen aus ${filename} …"
  npx openapi-typescript "$input_file" \
    --output "${TYPES_DIR}/${base}.openapi.ts"
  sed -i '1s;^;// @ts-nocheck\n;' "${TYPES_DIR}/${base}.openapi.ts"

  echo "✓ ${base} fertig"
  echo
done

echo "Alle OpenAPI-Typen aktualisiert."

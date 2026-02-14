#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/apply-photo-backgrounds.sh [--source-dir <dir>] [--dry-run]

Options:
  --source-dir <dir>  Source directory containing scene background images.
                      Default: public/assets/backgrounds/photos
  --dry-run           Validate and print mapping only, do not copy or edit files.
  -h, --help          Show this help.

Expected filenames (one per scene, any one of: .webp/.png/.jpg/.jpeg):
  scrap_yard
  sewer_gate
  clock_tower
  city_gate
  steam_square
  train_hub
  radio_lab
  outer_rooftop
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/public/assets/backgrounds/photos"
TARGET_DIR="$ROOT_DIR/public/assets/backgrounds"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-dir)
      if [[ $# -lt 2 ]]; then
        echo "[error] --source-dir needs a value" >&2
        exit 1
      fi
      SOURCE_DIR="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[error] Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[error] Source directory does not exist: $SOURCE_DIR" >&2
  exit 1
fi

SCENES=(
  scrap_yard
  sewer_gate
  clock_tower
  city_gate
  steam_square
  train_hub
  radio_lab
  outer_rooftop
)

declare -a mapping_entries=()

echo "[info] Source: $SOURCE_DIR"

echo "[info] Validating scene files..."
for scene in "${SCENES[@]}"; do
  matches=()
  for ext in webp png jpg jpeg; do
    candidate="$SOURCE_DIR/$scene.$ext"
    if [[ -f "$candidate" ]]; then
      matches+=("$candidate")
    fi
  done

  if [[ "${#matches[@]}" -eq 0 ]]; then
    echo "[error] Missing file for scene '$scene' in $SOURCE_DIR" >&2
    exit 1
  fi

  if [[ "${#matches[@]}" -gt 1 ]]; then
    echo "[error] Multiple files found for '$scene'. Keep only one extension." >&2
    printf '  %s\n' "${matches[@]}" >&2
    exit 1
  fi

  source_file="${matches[0]}"
  ext="${source_file##*.}"
  asset_path="assets/backgrounds/$scene.$ext"
  mapping_entries+=("$scene=$asset_path")
  echo "  - $scene -> $asset_path"
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[info] Dry run complete. No files were copied or modified."
  exit 0
fi

echo "[info] Copying background files into $TARGET_DIR"
for mapping in "${mapping_entries[@]}"; do
  scene="${mapping%%=*}"
  asset_path="${mapping#*=}"
  ext="${asset_path##*.}"

  source_file=""
  for candidate_ext in webp png jpg jpeg; do
    candidate="$SOURCE_DIR/$scene.$candidate_ext"
    if [[ -f "$candidate" ]]; then
      source_file="$candidate"
      break
    fi
  done

  if [[ -z "$source_file" ]]; then
    echo "[error] Source file not found during copy: $scene" >&2
    exit 1
  fi

  cp "$source_file" "$TARGET_DIR/$scene.$ext"
  echo "  - copied $scene.$ext"
done

mapping_json='{'
for mapping in "${mapping_entries[@]}"; do
  scene="${mapping%%=*}"
  asset_path="${mapping#*=}"
  mapping_json+="\"$scene\":\"$asset_path\","
done
mapping_json="${mapping_json%,}}"

node - "$ROOT_DIR" "$mapping_json" <<'NODE'
const fs = require('fs');
const path = require('path');

const rootDir = process.argv[2];
const mapping = JSON.parse(process.argv[3]);

const files = [
  path.join(rootDir, 'src/content/episodes/episode01.ts'),
  path.join(rootDir, 'src/content/episodes/episode02.ts'),
  path.join(rootDir, 'public/sw.js'),
];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [scene, assetPath] of Object.entries(mapping)) {
    const pattern = new RegExp(`assets/backgrounds/${scene}\\.(?:svg|webp|png|jpg|jpeg)`, 'g');
    text = text.replace(pattern, assetPath);
  }
  fs.writeFileSync(file, text);
}
NODE

echo "[done] Background assets applied and references updated."
echo "[next] Run: npm run build"

#!/usr/bin/env bash
# Assemble shot clips into a graded 16:9 film in the style of the reference reel.
#
# Usage: scripts/render.sh [edit-list] [output]
#   edit-list  CSV with lines: file,start_seconds,duration_seconds   (default: edit.csv)
#   output     output path                                          (default: output/film.mp4)
#
# Each shot is trimmed, fitted to 1920x1080 @ 24fps, graded (warm highlights,
# green/teal shadows, lifted blacks, soft contrast), given grain and a vignette.
# Audio is kept when present (silence otherwise), with tiny fades at each cut to
# avoid clicks. The film ends with a fade to black.
set -euo pipefail

EDIT="${1:-edit.csv}"
OUT="${2:-output/film.mp4}"
FADE_OUT="${FADE_OUT:-1.5}"
W=1920; H=1080; FPS=24

GRADE="colorbalance=rs=-0.03:gs=0.02:bs=0.04:rh=0.06:gh=0.02:bh=-0.06,\
curves=all='0/0.035 0.5/0.49 1/0.965',\
eq=contrast=1.04:saturation=0.88,\
vignette=angle=PI/5,\
noise=alls=5:allf=t"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$(dirname "$OUT")"

i=0; total=0
: > "$TMP/list.txt"
while IFS=, read -r file start dur; do
  [[ -z "${file// }" || "$file" == \#* ]] && continue
  [[ -f "$file" ]] || { echo "missing clip: $file" >&2; exit 1; }
  i=$((i+1)); seg="$TMP/seg_$(printf %02d "$i").mp4"
  has_audio=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$file" | head -n1)
  vf="scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},${GRADE},format=yuv420p"
  af="aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.04,afade=t=out:st=$(awk "BEGIN{print $dur-0.06}"):d=0.06"
  if [[ -n "$has_audio" ]]; then
    ffmpeg -nostdin -v error -y -ss "$start" -t "$dur" -i "$file" \
      -vf "$vf" -af "$af" -c:v libx264 -crf 16 -preset medium -c:a aac -b:a 256k "$seg"
  else
    ffmpeg -nostdin -v error -y -ss "$start" -t "$dur" -i "$file" -f lavfi -t "$dur" -i anullsrc=r=48000:cl=stereo \
      -map 0:v -map 1:a -vf "$vf" -c:v libx264 -crf 16 -preset medium -c:a aac -b:a 256k -shortest "$seg"
  fi
  echo "file '$seg'" >> "$TMP/list.txt"
  total=$(awk "BEGIN{print $total+$dur}")
  echo "shot $i: $file  [$start s +$dur s]"
done < "$EDIT"

[[ $i -gt 0 ]] || { echo "edit list is empty" >&2; exit 1; }

fo_start=$(awk "BEGIN{print $total-$FADE_OUT}")
ffmpeg -nostdin -v error -y -f concat -safe 0 -i "$TMP/list.txt" \
  -vf "fade=t=out:st=${fo_start}:d=${FADE_OUT}" \
  -af "afade=t=out:st=${fo_start}:d=${FADE_OUT},loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart "$OUT"

echo "done: $OUT  (${total}s, ${i} shots, ${W}x${H}@${FPS})"

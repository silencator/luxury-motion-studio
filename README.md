# Luxury Motion Studio

A pipeline for turning AI-generated (or filmed) car shots into graded cinematic reels.

## Workflow
1. Pick a prompt pack in `prompts/` and generate each shot in your video tool (Veo, Kling, Sora, Runway…).
2. Save the clips as `clips/01.mp4`, `clips/02.mp4`, …
3. Adjust `edit.csv` (file, start second, duration) to choose the best moment of each clip.
4. Render:
   ```bash
   scripts/render.sh            # -> output/film.mp4 (16:9, 1920x1080, 24fps)
   ```

What the render does: trim each shot → fit to 16:9 → apply a warm/teal film grade with lifted blacks
→ add grain and a vignette → tiny audio fades at cuts → join → fade to black → normalize loudness.

## Projects
- `prompts/silencator-992-gt3rs.md` — green 992 GT3 RS "SILENCATOR", 10 × 3 s, golden hour → night.

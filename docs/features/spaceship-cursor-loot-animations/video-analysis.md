# Video analysis — `gemini_generated_video_6c10d7c9.mp4`

**Status: INSPECTED (2026-11-08).** This file replaces the earlier blocked placeholder.
**Minor corrections (2026-11-08):** the `contact-3-detail.jpg` top span is **1.042–1.667 s**
(16 frames at 24 fps), not 1.625 s; the golden orb is a **wireframe sphere**, and the four small
satellite rings belong to the **ring shockwave**, not the idle orb.
The reference was decoded read-only with the host's existing `ffprobe` / `ffmpeg` /
ImageMagick; no application source, test, config, spec, plan, task or status file was changed.
The video is a design reference only: it is not copied into the app and none of the extracted
frames may ship as runtime assets.

- Source: `/home/raultorraco/Downloads/gemini_generated_video_6c10d7c9.mp4`
- Artifacts: `docs/features/spaceship-cursor-loot-animations/reference/`
- Analysis precision: 24 fps ⇒ **one frame = 41.7 ms**; all times below are ±1 frame unless stated.
- Legend: **[O]** observed in the decoded frames/audio; **[E]** extrapolated/inferred from an
  observed neighbour because the event itself is absent from the reference (see § 9).

## 1. Provenance and metadata

`ffprobe -v error -show_format -show_streams -of json <source>` produced:

| Field | Value |
| --- | --- |
| Container | MP4 / `mov,mp4,m4a,3gp,3g2,mj2`, `mp42` |
| File size | 7,181,994 bytes (6.85 MiB) |
| Container duration | 10.026667 s |
| Video duration / frames | 10.000000 s / 240 frames |
| Video codec | H.264 High, level 3.1, `avc1.64001f`, yuv420p, 8-bit |
| Resolution | 1280 × 720 |
| Frame rate | 24/1 fps constant (`r_frame_rate` = `avg_frame_rate`) |
| Video bitrate | 4,798,424 b/s |
| Colour | tv range, `smpte170m`, transfer `iec61966-2-1`, primaries `bt709` |
| Audio | AAC LC, 48 000 Hz, stereo (2 ch), 128 434 b/s, 10.026667 s, 470 packets |
| Other streams | none (no subtitle/data/attachment) |
| Creation metadata | `2026-11-08T10:36:15Z`, handler “ISO Media file produced by Google Inc.” |

Audio loudness (`ffmpeg -af ebur128=peak=true -f null -`): **integrated −17.8 LUFS**,
**true peak −1.6 dBFS**, **LRA 4.6 LU**. There is no silence gap; the quietest section is the
ambient intro (0.0–1.4 s).

## 2. Extraction and verification commands

Run from the repository root; `<src>` is the source path above and `<ref>` is
`docs/features/spaceship-cursor-loot-animations/reference`.

```bash
# 1. Verify existence/readability and record metadata
ls -l <src>
ffprobe -v error -show_format -show_streams -of json <src>
ffmpeg -version | head -1
magick -version | head -1

# 2. Full-sequence reference frames: every 250 ms, 1280 px wide (40 frames)
mkdir -p /tmp/frames4
ffmpeg -i <src> -vf "fps=4,scale=1280:-1" -frames:v 40 /tmp/frames4/raw-%03d.png
# 256-colour PNG8 encoding keeps the whole reference set under 20 MB
for f in /tmp/frames4/raw-*.png; do
  n=${f##*/raw-}; n=${n%.png}; t=$((10#$n - 1))
  ts=$(printf "%d.%03d" $((t/4)) $(((t%4)*250)))
  magick "$f" -colors 256 "PNG8:<ref>/frame-$ts.png"
done

# 3. Overview contact sheets (2 fps, 0.5 s apart, 5×2, 480 px tiles)
ffmpeg -i <src> -t 5 \
  -vf "fps=2,scale=480:-1,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7,tile=5x2" \
  -frames:v 1 -q:v 3 <ref>/contact-1.jpg
ffmpeg -ss 5 -i <src> \
  -vf "fps=2,setpts=PTS+5/TB,scale=480:-1,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7,tile=5x2" \
  -frames:v 1 -q:v 3 <ref>/contact-2.jpg

# 4. Detail contact sheet: 24 fps around press/pop and banner/ship loop
ffmpeg -ss 1.08 -t 0.68 -i <src> \
  -vf "fps=24,setpts=PTS+1.08/TB,scale=400:-1,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.7,tile=8x2" \
  -frames:v 1 cpress.jpg
ffmpeg -ss 7.56 -t 0.68 -i <src> \
  -vf "fps=24,setpts=PTS+7.56/TB,scale=400:-1,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.7,tile=8x2" \
  -frames:v 1 clevel.jpg
magick cpress.jpg clevel.jpg -append -quality 92 <ref>/contact-3-detail.jpg

# 5. Audio evidence
ffmpeg -i <src> -filter_complex "showspectrumpic=s=1280x480:legend=1:scale=log" -frames:v 1 spectrogram.png
ffmpeg -i <src> -filter_complex "showwavespic=s=1280x240:colors=#66ccff" -frames:v 1 waveform.png
ffmpeg -i <src> -ac 1 -ar 48000 -f wav audio.wav   # RMS envelope via Python stdlib
```

Verification of the artifact set: 40 frame PNGs + 3 contact sheets, **15 MB total** (limit ≈20 MB),
maximum width 1280 px. `frame-*.png` files are 256-colour PNG8 (210–372 kB each); the
quantisation can band the faintest nebula gradients but does not affect timing or silhouette
analysis. Contact sheets are JPEG q≈3/92 and keep their burn-in timestamps.

## 3. Scene and timeline

The clip is a 10 s capture of a space-themed cube clicker. A green 8 × 7 cube wall sits centre-left;
a metallic spaceship with twin engine plumes hovers at the right; HUD panels are fixed at the four
screen corners. The **visible pointer is a normal white OS arrow**, not a custom spaceship cursor.
The spaceship is a companion avatar parked at the right for most of the clip; it does not track the
pointer. There are no cuts or camera moves.

| Time | Beat | Observed action | Duration / frames |
| --- | --- | --- | --- |
| 0.00–1.00 | Idle | Static 8 × 7 green cube wall, fixed HUD, ship at right. Only the engine plumes flicker; pointer drifts over the wall. | 24 frames |
| 1.00–1.29 | Target lock | Pointer lands on the top-right cube. That cube gets a **2 px white outline**; six short white tick marks appear radially around the pointer (≈20 px from the tip). No squash, no scale. | ≈7 frames (≈0.29 s) |
| 1.29–1.75 | First pop | Cube face vanishes in one frame; a white-hot core with **12 tapered gold rays** (longest ≈160 px) expands, plus 10–14 green cube shards and 4–6 gold coin glyphs. `+0.50 Coins` appears above. | 0.46 s; peak 1.375–1.50 |
| 1.75–3.95 | Rapid clicking | Repeated pops at ≈0.4–0.6 s intervals across the wall. Each pop: 1-frame flash, ≈0.35–0.45 s starburst, 0.8–1.2 s debris/coin tails, a new `+0.50 Coins` popup. Crack overlays and cubes missing from the wall accumulate. | ≈2.2 s |
| 3.95–4.25 | Gold orb spawn | After a normal pop, a **golden wireframe sphere with an orange core** pops in at the wall centre. Radius ≈45 px → ≈75 px → settles ≈60 px. It then hovers, slowly rotating/pulsing. | 0.25 s spawn; persists to 6.21 |
| 4.25–6.20 | Charge / clicks | Normal pops continue around the orb; cursor repeatedly enters it. The orb brightens and pulses but does not translate; it carries no satellites (the four small ring satellites belong to the 6.21 ring shockwave). | ≈1.95 s |
| 6.21–6.70 | Ring shockwave | Orb flashes and releases a **golden ring with 8 radial spokes and 4 satellite rings**. Radius ≈70 → ≈350 px in ≈330 ms, then a ghost ring fades by ≈6.7 s. No screen shake; grid and HUD stay put. | ≈0.49 s |
| 6.79–7.54 | Level-complete burst | HUD flips to `100 (COMPLETE)`. A screen-filling burst: white core grows to ≈300 px radius, 16 primary gold rays + 8 thin cyan rays reach past the screen edge, 3 concentric gold rings expand, 40+ cubes, 20+ coins, hundreds of sparks and star glyphs. Global frame brightness peaks at 7.04 and decays to baseline by 7.54. | **0.76 s**; attack ≈0.25 s, release ≈0.51 s |
| 7.54–7.62 | Gap | Rays gone; coins/cubes/stars continue to drift; no banner yet. | ≈0.08 s |
| 7.62–8.30 | `LEVEL COMPLETE` | Banner appears at ≈0.2 scale, tilted ≈−8°, grows to ≈1.0 by 7.79, overshoots to ≈1.08 by 7.87, then settles to 1.0 with a ±2° rotational wobble by ≈8.1. A gold/white ring flashes behind it at 7.83–8.0 (audio impact at 7.87). | 0.68 s |
| 7.75–8.45 | Victory fly-by | Ship performs a full 360° roll on a ≈120 px-radius orbit to the right of the banner, leaving a 30–50 px-thick orange fire-trail arc that fades over ≈0.7 s. It returns upright at ≈8.45. | ≈0.70 s |
| 8.30–10.00 | Celebration idle | Banner stays at scale 1.0 with a 1–2 % glow/scale breathing; gold star comets, coins and confetti drift; ship resumes its right-side hover; HUD numbers update (coins reset to 1.00). | ≈1.7 s |

Key frames: `frame-1.000.png` (target lock), `frame-1.250.png` (pre-pop), `frame-1.500.png`
(pop peak), `frame-4.000.png` (orb spawn), `frame-6.250.png` / `frame-6.500.png` (ring),
`frame-7.000.png` (level peak), `frame-7.750.png` / `frame-8.000.png` (banner + fly-by),
`frame-8.250.png` (settled banner), `frame-9.750.png` (celebration).

## 4. Motion language

### 4.1 Duration hierarchy [O]

The clip reads as three deliberately separated time layers:

1. **Input layer (0–120 ms):** hover outline, reticle ticks, one-frame cube removal.
2. **Impact layer (80–450 ms):** core flash, rays, rings, banner entrance.
3. **Aftermath layer (0.6–2.0 s):** debris, coins, sparks, coin text, ship trail, star comets.

Nothing uses the same duration twice in the same layer: clicks are ≈0.35–0.45 s, the ring is
≈0.33 s of growth + 0.15 s fade, the level burst is 0.76 s, and the debris outlives all of them.
This staggered decay is the main reason the sequence feels dense rather than repetitive.

### 4.2 Input / target lock [O]

- The clickable cube under the pointer receives a **2 px white outline** for the whole ≈0.29 s
  approach (frames 1.042–1.292). It is a state highlight, not a press animation.
- Six short white ticks (≈2 × 14 px) radiate from the pointer at 60° intervals, ≈20 px from the
  arrow tip. They are visible from 1.042 to 1.292 and recur at every burst.
- **No squash, no scale-down, no press offset on the cube.** The cube disappears in a single
  frame (1.250 → 1.292 is the last pre-pop frame; the face is gone at 1.292).
- There is no custom cursor and no cursor trail; the OS arrow stays legible.

### 4.3 Pop / shatter [O]

- The pop is **instant conceal + additive burst**: the cube face is replaced by the flash in one
  frame, then separate debris carries the “shatter”.
- Core: white-yellow, circular, ≈20 px at onset → ≈45 px at peak (≈80 ms), with a hot white centre
  and a soft gold halo. It fades quickly (≈150 ms) while the rays remain.
- Rays: **12 primary tapered gold rays**, lengths alternating 90–160 px at peak, plus 6–10 thinner
  white needle sparks. Rays grow for ≈80 ms, hold ≈100 ms, then contract/fade by ≈1.75 s.
- Debris: 10–14 beveled green cubes, 18–30 px faces, ejected radially; they rotate ≈3–8 rad/s,
  decelerate, and persist >1.2 s. A few are still drifting at the next click.
- Coins: 4–6 gold discs, 16–20 px diameter, spin and arc outward; lifetimes ≈0.8–1.2 s.
- The burst is centred on the pointer, not on the cube's centre; the pointer sits inside the flash.

### 4.4 Currency feedback [O]

- `+0.50 Coins`: white text, ≈24 px, 2 px dark navy outline and a faint gold glow.
- Enter: ≈60–80 ms scale-up from ≈0.7 to 1.0 (no obvious overshoot) at 1.333–1.375.
- Rise: ≈45 px in ≈220 ms with an ease-out feel, then a near-stop/slow drift.
- Lifetime: the first popup is still readable at 2.17 s (≈0.84 s after spawn) and is gone by
  ≈2.5 s; observed lifetime is **≈1.1–1.2 s**, not 0.65 s. Two or three popups can coexist.
- HUD: the numeric coin/face counters update within 1–2 frames of the burst. There is **no row
  pulse, no scale, no colour flash and no HUD shake**; the floating text is the entire feedback.

### 4.5 Golden orb / charge [O]

- Spawns from a normal pop at ≈3.96: flash → sphere appears at radius ≈45 px, overshoots to ≈75 px
  within ≈40 ms, settles to ≈60 px by ≈4.25. This is a **≈25 % scale overshoot with a ≈250 ms
  settle**.
- Body: orange-white core inside a rotating gold wireframe sphere; the mesh lines are thin and
  additive. The idle orb carries no satellite rings: the four small rings at 45° appear only with
  the 6.21 ring shockwave (§4.6), where they brighten/fade with the ring.
- Idle: subtle scale/brightness pulse (≈±5 %) and slow mesh rotation; it does not translate.
- It persists ≈2.25 s and absorbs clicks; the cursor is on it at 6.0–6.2.

### 4.6 Ring shockwave [O]

- Start at ≈6.21; at 6.25 the ring is already ≈150 px radius, 6.33 ≈250 px, 6.375 ≈300 px,
  6.42 ≈330 px, 6.46 ≈350 px. This fits **ease-out-quad** (`1-(1-t)²`) much better than linear.
- Visual construction: a thick bright inner rim (≈15–20 px), a thin outer rim, 8 straight spokes at
  45° intervals, and 4 small rings at the diagonal intercardinals. A soft gold glow halo surrounds
  the whole ring.
- Fade: the inner mesh dissolves into the ring; the ring stays at full radius for ≈60 ms then fades
  as a ghost by ≈6.7 s. Total visible ≈0.49 s.
- No camera shake, no zoom, no HUD displacement. The grid and ship remain exactly in place.

### 4.7 Level-complete burst [O]

- Trigger: HUD changes to `100 (COMPLETE)` at 6.833, one frame after the first bright burst frame
  (6.792). The visual starts on the same beat as the state change.
- Layer 1 — core: white, radius 0 → ≈300 px over ≈380 ms (ease-out). Bloom is strong enough to
  clip the centre to white for ≈250 ms.
- Layer 2 — rays: 16 thick gold rays alternating with 8 thinner cyan/white rays; lengths grow to
  >640 px (past the screen edge) in ≈250 ms, then slowly retract/fade by ≈7.5 s. Several rays end
  in 4-point star glyphs.
- Layer 3 — rings: three concentric gold rings expand at different rates (radii roughly 120/220/330
  at 6.96, ≈400/520/640 at 7.17), thin (2–6 px), fading as they grow.
- Layer 4 — debris: 40+ green cubes, 20+ gold coins, hundreds of 2–4 px sparks and 10–20 large
  star glyphs; all decelerate and linger 1–2 s.
- Brightness envelope (`signalstats YAVG`, baseline 79.9): 6.792 = 91.6, 6.833 = 118.7,
  7.042 = 135.8 (peak), 7.292 = 119.5, 7.542 = 90.2 (≈baseline). So attack ≈250 ms,
  release ≈500 ms, total ≈760 ms.
- No camera shake; the HUD and ship are rock-steady. The screen-filling rays provide the impact.

### 4.8 `LEVEL COMPLETE` banner [O]

- First visible 7.625: ≈0.2 scale, ≈−8° rotation, partly obscured by the pointer.
- Growth: 7.667 ≈0.55, 7.708 ≈0.75, 7.750 ≈0.90, 7.792 ≈1.00, 7.833 ≈1.06, 7.875 ≈1.08.
- Settle: 7.917 ≈1.07, 8.000 ≈1.03, 8.083 ≈1.00, 8.30 stable. Rotation overshoots to ≈+2° and
  returns to 0 with a decaying ±2° wobble.
- The envelope is a **damped overshoot**: ≈8 % scale overshoot at ≈250 ms, settled by ≈450 ms.
  `easeOutBack` with a reduced overshoot (≈1.3) over ≈420–500 ms reproduces the feel; the default
  1.70158 overshoot (≈10 %) is close but slightly too springy.
- A white/gold ring flashes behind the banner at 7.83–8.0; the audio impact is at 7.87.
- After settling: 1–2 % scale/glow breathing at ≈1.5–2 s period; no further position changes.

### 4.9 Ship [O]

- Idle (0–7.5 s): hull position is fixed at ≈(1000, 300); no bob, roll or pitch is measurable
  beyond sub-pixel drift. The only idle motion is the **twin engine plumes**, whose length and
  brightness flicker on a 2–3 frame cycle (≈80–125 ms), from ≈60 px to ≈130 px.
- Spawn/level moments: the ship does not react to normal pops; it stays parked.
- Victory fly-by (7.75–8.45): full 360° roll while moving on a small ≈120 px-radius orbit to the
  right of the banner; the nose sweeps through up/left/down/right. The motion is fast at the start
  and eases into the final upright pose (≈0.55–0.70 s).
- Fire trail: a thick (30–50 px) orange-yellow ribbon follows the orbit, with a soft additive edge
  and embers; it persists ≈0.7 s after the ship has moved on, then fades. This is the only
  follow-through trail in the clip.
- The ship is never the pointer; it does not follow the mouse and does not bank with cursor velocity.

### 4.10 Background / camera [O]

- HUD is screen-fixed throughout. The nebula/star field does not shake or zoom; small asteroids and
  comets drift slowly (a comet at top-right early, another at lower-right late).
- There is no motion blur and no depth-of-field; depth is implied by scale, parallax of the
  background comets, and additive bloom.
- The level burst does not move the camera. All apparent “expansion” comes from the rays/rings and
  flying cubes.

### 4.11 Audio [O]

- Continuous musical bed; the spectrogram shows sparse low-frequency content 0–1.4 s, then a dense
  full-band texture from ≈1.4 s onward. No dialogue, no silence gaps.
- RMS peaks (20 ms windows, mono downmix): 1.48, 2.31, 2.75, 3.70, 4.05/4.15/4.24, 5.10/5.24,
  6.48, 7.01/7.12/7.22/7.39, 7.87.
- Visual/audio alignment: the first pop starts at 1.292 and its broadband transient lands at
  ≈1.35–1.40 (≈2–3 frames late). The level burst starts at 6.792, the next broadband onset is
  ≈6.92 and the loudest peak is 7.01 (≈5 frames after the visual trigger, consistent with a short
  riser/impact layer). The banner reaches full overshoot at 7.87, exactly on the 7.87 audio peak.
- The loudest moment is the level burst (true peak −1.6 dBFS); the celebration settles into the
  music bed with no further transients after ≈8.2.

### 4.12 Estimated easing signatures

| Motion | Samples | Best-fit feel | Suggested curve |
| --- | --- | --- | --- |
| Ring radius (6.21→6.46) | 70, 150, 200, 250, 300, 330, 350 at 0/40/80/120/165/210/250 ms | fast attack, long decelerate | `easeOutQuad` / `1-(1-t)²` |
| Orb spawn (3.96→4.25) | 45 → 75 → 70 → 60 → 58 px | overshoot then settle | `easeOutBack(1.2)` ≈250 ms |
| Banner scale (7.625→8.30) | 0.2 → 0.55 → 0.75 → 0.9 → 1.0 → 1.06 → 1.08 → 1.0 | damped overshoot | `easeOutBack(1.3)` ≈450 ms |
| Level core (6.79→7.17) | 0 → ≈300 px | fast attack, decelerate | `easeOutCubic` ≈380 ms |
| Level flash brightness | 91.6 → 118.7 → 135.8 → 90.2 | 250 ms attack, 500 ms release | two-stage `easeOutCubic` |
| Coin text rise (1.33→1.55) | ≈45 px then hold | quick rise, slow drift | `easeOutCubic` 220 ms + linear drift |
| Ship roll (7.79→8.30) | 0 → 360° | fast middle, soft settle | `easeInOutCubic` ≈550 ms |
| Debris | radial ejection then drag | no bounce; heavy decelerate | initial 250–500 px/s, drag ≈2 s⁻¹, gravity ≈800–1000 px/s² |

## 5. Visual-effects inventory

| Effect | Count / size | Lifetime | Notes |
| --- | --- | --- | --- |
| White core flash | 1 per pop; 20–45 px (pop), 100–300 px (level) | 80–200 ms (pop), 380 ms (level) | additive, clips to white |
| Tapered rays | 12 per pop; 16 gold + 8 cyan at level | 0.35–0.45 s (pop), 0.7–0.9 s (level) | alternating lengths; star tips at level |
| Shockwave ring | 1; 70→350 px radius, 8 spokes, 4 satellites | 0.33 s grow + 0.15 s fade | single gold additive ring |
| Cube debris | 10–14 per pop; 40+ at level; 18–30 px | 0.8–2.0 s | rotates 3–8 rad/s, drag + gravity |
| Gold coins | 4–6 per pop; 20+ at level; 16–20 px | 0.8–1.2 s (pop), 1.5–2.5 s (level) | spinning discs, arc out |
| Sparks | 6–10 thin needles per pop; hundreds at level | 0.3–0.6 s (pop), 1–2 s (level) | additive points |
| Star glyphs | 0–2 per pop; 10–20 at level; 10–30 px | 0.8–1.5 s | 4-point stars, some with trails |
| Coin popup text | 1 per coin gain; ≈24 px | ≈1.1–1.2 s | scale-in, 45 px rise, fade |
| Banner halo ring | 1; ≈250→450 px | ≈0.25 s | white/gold ring behind banner |
| Ship fire trail | 1 ribbon; 30–50 px thick, ≈250 px arc | ≈0.7 s | follows victory orbit |
| Ambient comets | 1–2 at a time | 2–4 s | slow background drift |
| Confetti (celebration) | dozens of 2–4 px magenta/green/cyan flecks | >2 s | drift with low gravity |

No screen shake, no lens distortion, no chromatic aberration, no depth-of-field, no motion blur.
“Speed” comes from tapered streaks and additive bloom.

## 6. What makes the motion feel fluent and satisfying

1. **Input is instant and unambiguous.** The white cube outline + six-tick reticle appear on hover,
   then the pop is one frame away. There is no eased delay between pointer and result.
2. **Three decay layers create depth.** Flash (≈80 ms) → rays/rings (≈300–450 ms) → debris/coins/text
   (≈1 s). The eye gets a punch, then details to follow; the effect never ends all at once.
3. **Radial symmetry plus alternating ray lengths.** 12 rays with 2–3 length classes and thin
   needle sparks read as explosive without random noise.
4. **Physical aftermath.** Cube shards rotate, decelerate and fall; coins arc; stars drift. Drag and
   gravity sell mass and cause-and-effect, so the explosion feels like it moved objects, not just
   painted a flash.
5. **Overshoot is reserved for hero beats.** The orb overshoots ≈25 %, the banner ≈8 %, the ship
   does a full roll; ordinary pops do not overshoot. That hierarchy keeps the big moments big.
6. **Palette continuity.** White core → gold mid → green/cyan fringe uses the scene's existing
   colours, so the additive effects do not look pasted on.
7. **The UI is an anchor.** HUD and ship never shake; the screen fills with radial rays while the
   HUD stays fixed. That keeps the game readable through the spectacle.
8. **Audio confirms the eye.** Transients land within ≈2–5 frames of the visual onsets, and the
   level burst is the loudest, longest envelope. The banner impact is exactly on the overshoot peak.
9. **Anticipation is a held target, not a wind-up.** The ≈0.25 s reticle dwell gives the player
   time to read the target; the pop itself has no slow wind-up, so clicking stays snappy.
10. **The aftermath overlaps the next input.** Debris from one pop is still in the air when the next
    pop fires, which makes rapid clicking feel like one continuous system rather than separate
    one-shots.

## 7. Mapping table — observed language → candidate game events

The table separates what the clip actually shows from values that must be extrapolated. The
reference **does not contain** a lootbox panel/reveal, a part-equip action, an upgrade purchase or a
custom cursor ship/trail; those rows are marked **[E]** and inherit the nearest observed envelope.

| Candidate game event | Observed reference language | Observed timing | Implementation recommendation |
| --- | --- | --- | --- |
| **Click / press** | White 2 px outline + six 14 px reticle ticks around the OS pointer; no cube squash; pop on the next frame | outline/ticks ≈0.25 s dwell; pop instant | 90 ms press scale `1→0.97→1` (`pressMs`) is a stylisation, not observed; keep a 120 ms reticle fade for fidelity |
| **Cube pop / shatter** | Cube face disappears in 1 frame; white core + 12 gold rays; 10–14 beveled shards; coin glyphs | burst ≈0.46 s; peak ≈1.375–1.50 | 160 ms pop scale + 350 ms burst (existing spec) is a good compression; add a 1-frame conceal before the burst |
| **Sparks / explosion** | 12 primary rays + 6–10 thin needles per pop; 16+8 rays + 3 rings at level | 0.35–0.45 s per pop; 0.76 s level | gold `0xffcc66` additive points + one shockwave (spec) matches; ray count 12 |
| **Coin / combo feedback** | `+0.50 Coins` popup, 45 px rise, 1.1–1.2 s life; 4–6 spinning coins; no combo counter | popup ≈1.2 s; coins ≈1 s | spec `coinPopMs 650` is faster than reference but acceptable for pace; if fidelity matters use 900–1100 ms; no HUD pulse observed |
| **Lootbox open / reveal** | **Not present.** Nearest: golden wireframe orb spawn (≈25 % overshoot, 0.25 s settle), 2.25 s hover/charge, ring burst (≈0.33 s), then `LEVEL COMPLETE` banner overshoot (≈8 %, 0.45 s settle) | charge 2.25 s; ring 0.33 s; banner 0.45 s | **[E]** replace “shake” with a charge pulse; use 420 ms charge, 120 ms flash, 360 ms reveal, 140 ms settle (spec defaults) — the reference has no shake |
| **Part equip** | **Not present.** Nearest: banner overshoot/settle and orb spawn overshoot | ≈0.25–0.45 s | **[E]** 260 ms row flash + `1.04` ship pulse (spec) is consistent with the observed overshoot scale |
| **HUD / upgrade purchase** | **Not present.** HUD numbers update instantly; no row pulse; only floating currency text | 1–2 frames | **[E]** 200–260 ms row pulse is an invention; keep it subtle and reduced-motion-safe |
| **Cursor idle / trail** | **No cursor ship.** OS arrow; companion ship has static hull + 80–125 ms plume flicker; victory loop has 0.7 s fire trail | plume cycle ≈0.1 s; trail ≈0.7 s | **[E]** bank ±0.28 rad, pitch ±0.18 rad, 8-point 220 ms trail (spec) are not observed; the reference supports only idle plume flicker + a long follow-through trail |
| **Level complete** | `LEVEL COMPLETE` banner + full-screen radial burst + ship 360° roll with fire trail | burst 0.76 s; banner 0.45 s settle; roll 0.55 s | Use the measured 0.76 s burst envelope and ≈8 % banner overshoot |

## 8. Concrete timing / easing recommendations

These are design recommendations for the planner; they do **not** change the pinned AC-34 token
values. Where the spec value is shorter than the observed reference, both are listed.

### 8.1 Timing tokens

| Token / motion | Spec value | Observed equivalent | Recommendation |
| --- | --- | --- | --- |
| Press | `pressMs 90` | reticle dwell ≈250 ms; no press scale | keep 90 ms for game feel; add a separate 120 ms hover reticle, not a press scale |
| Cube pop | existing 160 ms | 1-frame conceal + 0.46 s burst | keep 160 ms scale; conceal at t=0; burst ≈350 ms |
| Starburst rays | — | 12 rays, 80 ms grow, 350–450 ms fade | 12 rays; `easeOutQuint` grow; `linear`/`easeOutQuad` fade |
| Debris | — | 0.8–2.0 s | 0.9 s target, drag 2 s⁻¹, gravity 900 px/s², angular 3–8 rad/s |
| Coin popup | `coinPopMs 650` | ≈1.1–1.2 s | 650 ms for pace; 900–1100 ms for fidelity; rise 40 px in 220 ms |
| HUD pulse | `hudPulseMs 200` | not observed | 200 ms subtle scale/colour; no shake |
| Orb spawn | — | 45→75→60 px, ≈250 ms | `easeOutBack(1.2)` 250 ms |
| Ring shockwave | `shockwaveMs 260` | 330 ms grow, ≈490 ms visible; 70→350 px | 260 ms for click-size; 480–560 ms for special/level-size |
| Lootbox charge | `lootboxShakeMs 420` | orb hover 2.25 s; no shake | use 420 ms charge pulse (scale 1→1.06→1), not a shake |
| Lootbox burst | `lootboxBurstMs 120` | 80–150 ms core flash | 120 ms flash is supported |
| Lootbox reveal | `lootboxRevealMs 360` | banner 160 ms in, 450 ms settle | 360 ms reveal + 140 ms settle is supported |
| Equip pulse | `equipPulseMs 260` | not observed; banner settle 450 ms | 260 ms is fine as an extrapolation |
| Upgrade pulse | `upgradePulseMs 260` | not observed | 200–260 ms |
| Trail | `trailLifetimeMs 220`, `trailCount 8` | no cursor trail; ship fire trail ≈700 ms | keep 8/220 for cursor; use a separate 700 ms ribbon for the victory fly-by |
| Ship bank | `shipBankMaxRad 0.28`, gain 2.4 | no velocity banking observed | keep as game-feel invention |
| Ship pitch | `shipPitchMaxRad 0.18`, gain 1.6 | no pitch observed | keep as game-feel invention |
| Ship idle | amplitude 0.015, period 2600 ms | hull static; plume flicker ≈0.1 s | 0.015 is subtle and safe; add plume flicker 80–125 ms |
| Equip scale | `equipPulseScale 0.04` | orb overshoot 25 %, banner 8 % | 4 % is conservative and consistent |

### 8.2 CSS keyframe shapes (for the panel/HUD layer)

- **Coin pop:** `0% {opacity:0; transform:translateY(0) scale(.7)} 8% {opacity:1; transform:translateY(-4px) scale(1)} 40% {transform:translateY(-28px) scale(1)} 75% {opacity:1; transform:translateY(-40px)} 100% {opacity:0; transform:translateY(-45px)}` over 650–1100 ms, `cubic-bezier(.22,1,.36,1)`.
- **Lootbox reveal (1040 ms):** charge 0–420 ms (`scale(1→1.03→1)` sine), flash 420–540 ms (`opacity 0→1→0` + `scale(1.04)`), reveal 540–900 ms (`scale(.86→1.08)` `cubic-bezier(.34,1.56,.64,1)`), settle 900–1040 ms (`scale(1.08→1)`).
- **Banner pop (reference):** `scale(.2) rotate(-8deg)` at 0 ms → `scale(1.08) rotate(1.5deg)` at 250 ms → `scale(1) rotate(0)` at 450 ms; then a 1.5 s glow/scale breathing loop.
- **HUD/upgrade row pulse:** 260 ms `background-color` + `scale(1.02)` with `easeOutCubic`, no translate.

### 8.3 Three.js / canvas notes

- Keep **one** `Points` system for sparks/coins/stars and **one** instanced mesh for cube debris;
  the reference's density is high (hundreds of sparks at level clear) but all are small additive
  quads, not unique geometries.
- Rays are best as a single pre-built radial geometry (12–24 tapered triangles) scaled/faded as a
  unit, not 12 meshes per pop.
- Ring: one `RingGeometry` with a custom shader or a textured quad; the 8 spokes and 4 satellites
  can be baked into the texture to keep it one draw call.
- Use `AdditiveBlending`, `depthWrite: false`, and a bloom pass; clamp `toneMapped` off for the
  white core so it clips cleanly.
- Pool every effect (12 pops × 14 debris = 168 instances worst case; the reference overlaps ~3
  pops). Recycle oldest first, as the spec's 3-ring pool already does.
- No per-frame allocations: preallocate vectors/colours and reuse them in `update`.
- The HUD must stay screen-space; do not parent it to the shake/zoom camera (there is no shake in
  the reference, and the HUD should remain still in the game either way).

### 8.4 Reduced-motion variants

The reference has no reduced-motion version; these variants preserve the information while removing
vestibular triggers:

| Effect | Reduced-motion variant |
| --- | --- |
| Hover reticle | static 2 px outline; ticks off |
| Cube pop | 80 ms colour/opacity flash; no scale, no rays, no debris |
| Coin popup | static `+N` for 600 ms, no rise/scale; or only the numeric HUD update |
| Shockwave | 120 ms opacity flash at the ring's final radius; no expansion |
| Orb charge | static orb, no pulse/rotation; ring replaced by 150 ms glow |
| Level burst | 150 ms white overlay at ≤15 % opacity; no rays/rings/debris/coins |
| Banner | fade in at scale 1 over 120 ms; no rotation/overshoot; no breathing |
| Ship fly-by | no roll/orbit/trail; ship stays at the right |
| Ambient | static background; no comets/confetti drift |

All reduced-motion variants keep the state change (numbers, banner text, reveal content) and keep
audio cues; only the motion is suppressed. Use `prefers-reduced-motion: reduce` and also the
in-game reduce-motion toggle if one exists.

## 9. AC-40 status and open questions

**Observed coverage.** The clip fully supports observed values for:
click/hover target language, cube pop/shatter, sparks, coin popup/coin glyphs, the golden-orb
charge, the ring shockwave, the level-complete burst, the banner overshoot, the ship's idle plume
flicker and victory roll/trail.

**Events absent from the reference.** It contains **no** lootbox panel/reveal, **no** part-equip
action, **no** upgrade purchase, and **no** custom cursor ship or cursor trail. The ship is a
stationary companion; the pointer is the OS arrow. Therefore AC-40's requirement of “observed
values for every mapped game event in § Reference mapping” is **not fully satisfiable from this
video**. The honest status is:

- AC-40 passes for the observed beats (frames + timestamps are present).
- AC-40 cannot pass for lootbox, equip, upgrade and cursor trail unless those rows are explicitly
  accepted as extrapolations, or the video is replaced/extended with a clip that shows them.

**Candidate resolution (for the planner/orchestrator, not applied here):** split AC-40 into
“observed-beat fidelity” (this file + frames) and “extrapolated-beat provenance” (each absent row
carries the nearest observed envelope and a `[E]` marker). The current spec's per-event observed
claim should be amended accordingly; the animation system itself remains buildable with the spec's
default tokens.

## 10. Artifact manifest

All paths relative to `docs/features/spaceship-cursor-loot-animations/reference/`.

### Contact sheets

| File | Contents |
| --- | --- |
| `contact-1.jpg` | 0.0–4.5 s, 2 fps, 10 tiles, burn-in timestamps |
| `contact-2.jpg` | 5.0–9.5 s, 2 fps, 10 tiles, burn-in timestamps |
| `contact-3-detail.jpg` | top: press/pop 1.042–1.667 s at 24 fps; bottom: banner/fly-by 7.583–8.208 s at 24 fps |

### Frame sequence (4 fps, 40 PNGs, 1280 × 720, 256-colour PNG8)

| Frame | Observed content |
| --- | --- |
| `frame-0.000.png` | idle wall, ship right, pointer upper-left |
| `frame-0.250.png` | idle |
| `frame-0.500.png` | idle; pointer over wall |
| `frame-0.750.png` | idle; pointer over wall |
| `frame-1.000.png` | target lock begins (outline + ticks) |
| `frame-1.250.png` | held target lock, cube outlined |
| `frame-1.500.png` | first pop peak, debris + `+0.50 Coins` |
| `frame-1.750.png` | burst decay, debris, text |
| `frame-2.000.png` | second pop upper-right |
| `frame-2.250.png` | second pop decay, text |
| `frame-2.500.png` | pop at top-left, coin text |
| `frame-2.750.png` | pop/debris, text |
| `frame-3.000.png` | pop left, debris |
| `frame-3.250.png` | pop left |
| `frame-3.500.png` | pop centre-left |
| `frame-3.750.png` | pop centre-left |
| `frame-4.000.png` | golden orb spawn (overshoot) |
| `frame-4.250.png` | orb settled, debris |
| `frame-4.500.png` | orb + orange burst at left |
| `frame-4.750.png` | orb + debris |
| `frame-5.000.png` | orb + pop at right |
| `frame-5.250.png` | orb + pop |
| `frame-5.500.png` | orb + pop lower-right |
| `frame-5.750.png` | orb + debris |
| `frame-6.000.png` | orb, pointer on it |
| `frame-6.250.png` | ring shockwave begins (≈150 px) |
| `frame-6.500.png` | ring near full (≈300–350 px, 8 spokes) |
| `frame-6.750.png` | ring ghost, grid intact |
| `frame-7.000.png` | level burst peak (rays/coins/cubes) |
| `frame-7.250.png` | level burst decay, cubes flying |
| `frame-7.500.png` | burst tail, particles |
| `frame-7.750.png` | banner small/tilted, ship starts loop |
| `frame-8.000.png` | banner near full, ship banked |
| `frame-8.250.png` | banner settled, ship roll/trail |
| `frame-8.500.png` | celebration, ship returning |
| `frame-8.750.png` | celebration |
| `frame-9.000.png` | celebration |
| `frame-9.250.png` | celebration |
| `frame-9.500.png` | celebration |
| `frame-9.750.png` | final celebration frame |

Additional analysis-only evidence (not committed): the frame-by-frame JPEG set in
`/tmp/opencode/vid/all/`, the audio RMS script output, and the spectrogram/waveform images. These are
scratch files; the repository evidence is the `reference/` set above.

## 11. Limitations

- Frame timing is 24 fps; sub-42 ms differences are not measurable. The press ripple and the first
  few milliseconds of the pop are therefore reported as “≤1–2 frames”.
- Radius, ray count and particle counts are visual estimates from 1280 px frames (no scene graph or
  project file is available).
- PNG8 quantisation may shift faint nebula colours; it does not affect silhouettes, timings or the
  palette call-outs (white/gold/green/cyan).
- The audio analysis is envelope/spectrum based; instrument identity and exact SFX layering cannot
  be isolated from the mixed track.
- The reference is a rendered product demo, not a technical capture: some “effects” may be baked
  into sprite sheets or post-production; the recommendations describe the visible result, not the
  original implementation.

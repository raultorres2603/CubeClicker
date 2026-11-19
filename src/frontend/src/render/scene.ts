/**
 * Scene composition, camera flights, world travel and intent application (plan § Render
 * interfaces; spec AC-1 … AC-4, AC-9, AC-10, AC-15, AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * assembles the pieces the other render tasks own ({@link createStarfield} backdrop,
 * {@link createCubeView} cube, {@link createParticleSystem} explosions,
 * {@link createBackgroundLife} distant life, {@link createCosmicBackdrop} nebula,
 * asteroids, meteors, comet and hero ship) plus the lights and the pinned camera, and is
 * the single place that turns engine output into three.js state:
 *
 * - {@link SceneView.applyIntents} consumes the engine's one-shot `EffectIntent`s:
 *   an `explosion` reads the tile's world origin and outward face normal, starts the
 *   tile's 140 ms destroy and spawns the spark burst, green shard debris and the little
 *   explosion (white core, embers, smoke) in front of that surface (AC-7); `faceCleared`
 *   starts the face-removal countdown (there is no plate to fade —
 *   spec AC-2); `levelChanged` only marks the rebuild *pending* (the next snapshot carries
 *   the new style, grid size and travel direction); and `travelStarted` needs nothing of
 *   its own — the travel transition is driven by the snapshot.
 * - {@link SceneView.applySnapshot} is the per-frame pull, in the pinned order: motion
 *   setting → rebuild step → camera (intro dolly, directional travel flight or the rest
 *   pose over the current cube) → cube orientation → reduced-motion settle and quality
 *   matrix application.
 * - {@link SceneView.update} advances the frame-driven parts: the adaptive quality
 *   policy, the cursor/trail and target lock, the particle, impact and destroy aging, the
 *   face-removal countdowns, the background life, the camera-anchored cosmic backdrop's
 *   slow drift and the remote world (AC-4, AC-7, AC-12, AC-52).
 *
 * World model (spec § 3): cubes live on a flat plane and the camera is always axis-aligned
 * with the identity quaternion, so screen-right is world +x and screen-up is world +y. A
 * level's cube sits at its own world position ({@link SceneView} keeps `cubePosition`) and
 * the next cube spawns one {@link CUBE_SPACING} step in the drawn direction; at the travel
 * midpoint the old cube view is disposed and the new one is built at the new position.
 *
 * Online integration (T12; spec § 5, § 6, § 9). The own cube sits at the server-assigned
 * slot position (`ownPosition`), so the rest pose and the intro dolly are centred on it.
 * A `nextLevel` travel is destination-driven: the flight interpolation is the accepted
 * formula with `travelDestination − travelFrom` as its offset (the z table is retained),
 * and while the online hold has no destination yet the camera stays at rest with progress
 * 0. `spectate`/`return` flights render the T11 pose from the current rest to the target
 * and never rebuild a level. The remote cubes live in a {@link WorldView}: it is built on
 * `enterWorld` (after `welcome`, with the server's `maxUsers`) and replaced exactly at the
 * level midpoint when a queued `worldEntered` swap is applied.
 *
 * The scene receives values only; it never reads the engine (plan § Data flow) and it
 * owns every three.js object it creates, so `dispose()` can release them exactly once
 * (AC-15). Drawables stay bounded: one starfield `Points`, one cube view (body + ≤ 6
 * `InstancedMesh`), one pooled particle `Points`, one background-life group, one
 * `cosmic-backdrop` group (70 objects) owning the nebula `DataTexture` used as
 * `scene.background`, and, online, one remote world of ≤ (X − 1) cube views (AC-10,
 * AC-16). The backdrop group is camera-relative anchored like the starfield, extended with
 * the pinned presentation-only offsets {@link COSMIC_ANCHOR_OFFSET_X} and
 * {@link COSMIC_ANCHOR_OFFSET_Y}: every `update` (and construction, for the first frame)
 * places the group at the live camera `x`/`y` plus `(6, 4)` with `z = 0`, so the pinned
 * right-side comet and hero ship keep their screen composition above/right of the cube from
 * every server slot while their local `z < -4` depth stays world-behind the cube (AC-11,
 * AC-17). The offsets move the decorative group only: they carry no game or protocol state.
 */

import {
  AmbientLight,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';

import {
  BURST_ORIGIN_OFFSET,
  easeInOutQuad,
  easeOutCubic,
  SHOT_TRAVEL_MS,
  timingsFor,
  travelSwing,
} from '../game/effects';
import type { EffectIntent, EngineSnapshot, TravelKind } from '../game/engine';
import { interpolateRotation } from '../game/rotation';
import { normalizeAppearanceV3, shotStyleForPart } from '../game/parts-v3';
import {
  GRID_SIZE,
  type CubeStyle,
  type FaceId,
  type MiniCubeId,
  type Phase,
  type TravelDirection,
} from '../game/types';
import type { MemberState, Position, ServerMessage } from '../multiplayer/protocol';
import { createCubeView, FACE_NORMALS, type CubeView } from './cube-view';
import { createImpactEffects, type ImpactEffects } from './impact-effects';
import { createParticleSystem, type ParticleSystem } from './particles';
import {
  createQualityPolicy,
  qualityFeatures,
  QUALITY_SHADOW_MAP_SIZES,
  type QualityPolicy,
  type QualityTier,
} from './quality';
import { travelCameraPose as spectateTravelPose } from './spectate-travel';
import { createStarfield, type Starfield, type StarfieldAnchor } from './starfield';
import { createSpaceship, type Shot, type Spaceship } from './spaceship';
import { createTargeting, type Targeting } from './targeting';
import { createBackgroundLife, type BackgroundLife } from './background-life';
import { createCosmicBackdrop, type CosmicBackdrop } from './cosmic-backdrop';
import { createRemoteShip, remoteShipFallbackTarget, type RemoteShip } from './remote-ship';
import { createWorldView, type WorldView } from './world';

/** Ambient fill-light intensity. */
export const AMBIENT_INTENSITY = 0.6;

/** Lower clamp bound for the star-driven ambient fill intensity (AC-3). */
export const AMBIENT_INTENSITY_MIN = 0.5;

/** Upper clamp bound for the star-driven ambient fill intensity (AC-3). */
export const AMBIENT_INTENSITY_MAX = 1.0;
/** Key-light intensity. */
const KEY_INTENSITY = 1.2;

/**
 * Key-light shadow map size (width and height) at the high tier — AC-2. Reuses
 * {@link QUALITY_SHADOW_MAP_SIZES.high} (2048) so the construction pin and the tier matrix
 * cannot drift; {@link SceneView} scales the live map from the same matrix (medium 1024,
 * low off).
 */
export const KEY_SHADOW_MAP_SIZE = QUALITY_SHADOW_MAP_SIZES.high;

/** Key-light shadow bias — AC-2. */
export const KEY_SHADOW_BIAS = -0.0001;

/** Key-light shadow normal bias — AC-2. */
export const KEY_SHADOW_NORMAL_BIAS = 0.02;

/** Key-light shadow radius (PCF softness) — AC-2. */
export const KEY_SHADOW_RADIUS = 2;
/** Key-light position: front-top-right of the cube. */
const KEY_LIGHT_POSITION = { x: 6, y: 8, z: 10 };

/** Camera rest distance — the gameplay position, and the end of the intro dolly (AC-2). */
const REST_Z = 12;

/** Travel pull-away end distance (AC-3, retained from the predecessor AC-22). */
const TRAVEL_END_Z = 90;

/** Intro start distance (spec AC-2) — the original AC-22 value, now always pointing at the cube. */
const INTRO_START_Z = 60;

/** Pinned lens (AC-2). */
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** The camera always looks at the cube centre, wherever the flights put it. */
const ORIGIN = new Vector3(0, 0, 0);

/** Components this close to an integer are quarter-turn trig residue (spec AC-3). */
const QUARTER_TURN_EPSILON = 1e-9;

/** Distance between consecutive cube world positions (spec § 3). */
export const CUBE_SPACING = 24;

/**
 * Presentation-only screen-right offset added to the camera anchor of the cosmic backdrop
 * group (T16). The comet keeps its pinned local `(7.5, 2.2, -18)`: at the rest camera's
 * depth of 30 this offset gives a camera-relative screen angle of
 * `atan((7.5 + 6) / 30) = 24.23°`, outside the measured `14.7°–16.6°` cube silhouette. It
 * carries no game or protocol state and consumes no `random` draw.
 */
export const COSMIC_ANCHOR_OFFSET_X = 6;

/**
 * Presentation-only screen-up offset added to the camera anchor of the cosmic backdrop
 * group (T16). The hero ship becomes camera-relative `(15, 1.5, -14)`, so its 1280×720
 * projection clears the bottom-right upgrades panel. It carries no game or protocol state
 * and consumes no `random` draw.
 */
export const COSMIC_ANCHOR_OFFSET_Y = 4;

/**
 * World offsets of the four travel directions (spec § 3, pinned): screen axes equal world
 * axes because the camera is always axis-aligned, so `right` is +x, `top` is +y, etc.
 */
export const TRAVEL_DIRECTION_OFFSETS: Readonly<
  Record<TravelDirection, { readonly x: number; readonly y: number }>
> = {
  left: { x: -CUBE_SPACING, y: 0 },
  right: { x: CUBE_SPACING, y: 0 },
  top: { x: 0, y: CUBE_SPACING },
  bottom: { x: 0, y: -CUBE_SPACING },
};

/**
 * Writes the intro camera pose for clamped `progress` into the caller-owned vectors
 * (spec AC-2) — zero allocation per frame.
 *
 * A straight, eased dolly-in along the view axis: the target is the cube centre at every
 * progress and the position is `(0, 0, 60 − 48 · easeOutCubic(p))`, i.e. from
 * {@link INTRO_START_Z} (`60`) to the rest pose (`12`). The cube is centred and fully framed
 * from the first frame; the path is strictly monotonic and the camera quaternion is the
 * identity at every instant (spec § 2).
 */
export function introCameraPose(
  progress: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const travelled = easeOutCubic(clamped);

  outPosition.set(0, 0, INTRO_START_Z - (INTRO_START_Z - REST_Z) * travelled);
  outTarget.set(ORIGIN.x, ORIGIN.y, ORIGIN.z);
}

/**
 * Writes the directional travel pose for clamped `progress` into the caller-owned vectors
 * (spec § 3) — zero allocation per frame.
 *
 * Over the old cube at `(fromX, fromY)` and the drawn direction's offset `(dx, dy)`:
 * `x(p) = fromX + dx · easeInOutQuad(p)`, `y(p) = fromY + dy · easeInOutQuad(p)` and the
 * retained symmetric pull-back `z(p) = 12 + 78 · travelSwing(p)` (12 → 90 at the midpoint →
 * 12). The look target is the lateral point `(x(p), y(p), 0)`, so the camera looks straight
 * down the view axis and its quaternion stays the identity at every p.
 *
 * `direction === null` is the defensive case (no drawn direction): the lateral offset is
 * zero and the camera pulls back over `(fromX, fromY)`.
 */
export function travelCameraPose(
  progress: number,
  fromX: number,
  fromY: number,
  direction: TravelDirection | null,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const offset = direction === null ? null : TRAVEL_DIRECTION_OFFSETS[direction];
  writeTravelPose(
    progress,
    fromX,
    fromY,
    offset === null ? 0 : offset.x,
    offset === null ? 0 : offset.y,
    outPosition,
    outTarget,
  );
}

/**
 * Writes the accepted travel pose for one explicit lateral offset into the caller-owned
 * vectors (zero allocation per frame). This is the common core of the offline
 * direction-driven flight ({@link travelCameraPose}) and the online destination-driven
 * flight (`travelDestination − travelFrom`): the lateral interpolation is
 * `easeInOutQuad(p)` and the retained symmetric depth is `12 + 78 · travelSwing(p)`.
 */
function writeTravelPose(
  progress: number,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const lateral = easeInOutQuad(clamped);
  const x = fromX + dx * lateral;
  const y = fromY + dy * lateral;

  outPosition.set(x, y, REST_Z + (TRAVEL_END_Z - REST_Z) * travelSwing(clamped));
  outTarget.set(x, y, 0);
}

/**
 * Snaps every component of `v` within {@link QUARTER_TURN_EPSILON} of an integer to that
 * integer and returns `v` (in place, for chaining). A quarter-turn matrix carries residue
 * such as `cos(π/2) ≈ 6.12e-17`, which would otherwise leak into asserted burst positions;
 * genuine in-between normals are far from integers and pass through untouched. `-0` is
 * normalised to `0`, so the snapped vector compares exactly.
 */
export function snapToQuarterTurns(v: Vector3): Vector3 {
  v.set(snapComponent(v.x), snapComponent(v.y), snapComponent(v.z));
  return v;
}

/** One component of {@link snapToQuarterTurns}. */
function snapComponent(value: number): number {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) <= QUARTER_TURN_EPSILON) {
    // `+ 0` turns a `Math.round(-1e-17)` result of `-0` into a plain `0`.
    return rounded + 0;
  }
  return value;
}

/** One cleared face waiting for its removal countdown (spec AC-2: no plate, no fading). */
interface FaceRemoval {
  /** Milliseconds the countdown has run so far. */
  elapsedMs: number;
  /** Total countdown: the active profile's `faceFadeMs` (400 / 100 ms). */
  readonly durationMs: number;
}

/**
 * The authoritative server world the scene renders (T12; spec § 5, § 9). Values only:
 * they arrive from `multiplayer/server-state.ts` after `welcome`/`worldEntered` and the
 * scene never invents or re-derives a shared position.
 */
export interface SceneWorld {
  /** Server capacity X — the remote world renders at most `X − 1` cubes (Q-T10-1). */
  maxUsers: number;
  /** The own member's server-assigned slot position (`rest pose = (px, py, 12)`). */
  ownPosition: Position;
  /** The server's other members in slot order; the own member is never in this list. */
  roster: readonly MemberState[];
}

/**
 * The composed scene handed to the session/loop: the three.js root, the camera, the
 * per-frame inputs and the lifecycle hooks.
 */
export interface SceneView {
  /** The scene root (starfield, cube view, particles, lights). Exposed for tests/loop. */
  scene: Scene;
  /** The pinned camera (AC-2). */
  camera: PerspectiveCamera;
  /**
   * The cube view currently in the scene, for callers that need its handles at call
   * time (the session's `pickMiniCube(camera, cubeView, …)` pick).
   *
   * A `readonly` accessor, not a stored field: the snapshot rebuild replaces the cube
   * view, so a reference captured once would be the disposed previous handle. Re-read it
   * at the point of use.
   */
  readonly cubeView: CubeView;
  /**
   * The remote-cube world view, or `null` before the first `welcome` (offline defaults and
   * the pre-welcome intro). It is rebuilt exactly once at a cross-server level midpoint.
   */
  readonly worldView: WorldView | null;
  /**
   * The procedural cosmic backdrop (AC-10, AC-11): its `group` is the ninth scene child,
   * after `background-life`, and its `nebulaTexture` is `scene.background`. Created once
   * and never rebuilt, so the seeded starfield/background-life draws keep their sequence.
   */
  readonly cosmicBackdrop: CosmicBackdrop;
  /**
   * Enters a server world immediately (`welcome`/resume): builds the {@link WorldView} with
   * the server's `maxUsers`, applies the remote roster, moves the own cube to
   * `ownPosition` and clears any queued cross-server swap. Replaces a previous world by
   * disposing it exactly once.
   */
  enterWorld(world: SceneWorld): void;
  /**
   * Queues a cross-server move (`worldEntered`): the replacement world is applied at the
   * next level midpoint, together with the `levelChanged` rebuild. The old {@link WorldView}
   * is disposed exactly once and the new one is built from the new roster.
   */
  queueWorldSwap(world: SceneWorld): void;
  /**
   * Applies one remote-cube server message (`miniCubeRemoved`, `levelAdvanced`,
   * `memberJoined`, `memberLeft`) to the live {@link WorldView}; a no-op before `welcome`.
   * A removal for the mounted spectated member also fires their remote ship (AC-20) at the
   * removed tile's world origin, or at the AC-20 fallback target when the tile is already
   * hidden; every other member's removal spawns nothing.
   */
  applyWorldMessage(msg: ServerMessage): void;
  /**
   * Mounts the one remote ship the scene may render — the member the camera is spectating
   * (AC-15). `null` unmounts it. The ship is created lazily under the `remote-ships` manager
   * and disposed exactly once; asking again for the already-mounted member is a no-op, an
   * unknown id mounts nothing, and no ship exists before `welcome`, during a
   * spectate/return camera flight, or when the member's cube is not in the rendered world.
   */
  setSpectatedMember(playerId: string | null): void;
  /**
   * Re-skins the mounted remote ship with a live `memberAppearance` projection (AC-15,
   * AC-17, AC-26). A no-op unless `playerId` is the mounted member; the model is updated in
   * place (no remount, no second dispose) and a repeated record writes nothing.
   */
  setSpectatedAppearance(playerId: string, appearance: Record<string, string>): void;
  /**
   * Stores the latest pointer NDC so the spaceship can follow it on subsequent frames
   * (spaceship-cursor spec AC-2, AC-7). Both components are clamped to `[-1, 1]`.
   */
  setPointerTarget(ndcX: number, ndcY: number): void;
  /**
   * Shows the target lock (tile outline + reticle) on the hovered mini-cube, or hides it
   * for `null` (AC-35). The session resolves the hovered id at most once per frame (T10).
   */
  setHoverTarget(id: MiniCubeId | null): void;
  /**
   * Starts the one 700 ms level-complete fly-by (AC-40). Production calls it from the
   * `levelIndex` rise in {@link SceneView.applySnapshot} — the same snapshot transition
   * that mounts the App's `LevelCompleteBanner` — so the roll rides every completion.
   * Exposed for integration tests. No-op under reduced motion, after disposal, or while a
   * fly-by is already running.
   */
  triggerFlyBy(): void;
  /** The current adaptive quality tier (AC-52). */
  getQualityTier(): QualityTier;
  /**
   * Test hook: forces a quality tier and applies its feature matrix immediately. T14 uses
   * it for the high/medium/low traces; the normal policy can still recover afterwards.
   */
  setQualityTierForTesting(tier: QualityTier): void;
  /**
   * In-flight shots (delegated from the spaceship). Emptied by `dispose()`.
   */
  readonly shots: readonly Shot[];
  /**
   * The most recent frame time retained from the last `applyIntents`/`applySnapshot`
   * call, defaulting to `0`. Drives burst spawning for shots that arrive in `update`.
   */
  readonly lastFrameTime: number;
  /**
   * The last appearance applied to the spaceship (shallow copy), defaulting to `{}`.
   * Exposed for tests.
   */
  readonly lastAppearance: Record<string, string>;
  /** Alias for {@link lastAppearance}. */
  readonly lastAppliedAppearance: Record<string, string>;
  /** Alias for {@link lastAppearance}. */
  readonly appliedAppearance: Record<string, string>;
  /**
   * Applies the engine's ordered effect intents: explosion → start the tile's pop and spawn
   * its burst in front of the face surface; `faceCleared` → start the face-removal
   * countdown; `levelChanged` → mark the cube rebuild pending (the next snapshot performs
   * it). `nowMs` is the frame time used to order pooled bursts.
   */
  applyIntents(intents: EffectIntent[], nowMs: number): void;
  /**
   * Applies one engine snapshot in the pinned order: motion setting, rebuild step (exactly
   * one rebuild when a level change is pending or the style/grid size changed), camera
   * (intro dolly, the destination-driven online flight or the drawn-directional offline
   * flight, a spectate/return flight, or the rest pose over the current cube), the
   * reduced-motion settle and the adaptive quality matrix.
   *
   * `nowMs` is the frame time the plan's contract carries (the loop passes it); the
   * snapshot application itself is a pure function of the snapshot values — the flights
   * read `phaseProgress`, the expansion is applied on {@link SceneView.update} — so the
   * scene does not consume it.
   */
  applySnapshot(snapshot: EngineSnapshot, nowMs: number): void;
  /**
   * Advances the frame-driven parts: the starfield swirl/scale, particles, removals, pops
   * and the cosmic backdrop (forwarded with the frame `dtMs` and `reducedMotion`).
   */
  update(dtMs: number): void;
  /**
   * Disposes every geometry/material it owns (exactly once), clears the nebula
   * `scene.background` before releasing the backdrop, and empties the scene.
   */
  dispose(): void;
}

/**
 * Construction options of one {@link SceneView}.
 *
 * Exported so the session's injected render runtime (`RenderRuntime` in
 * `game/session.ts`) can describe `createSceneView` without importing this module at
 * runtime — the session only keeps a type-only reference.
 */
export interface SceneViewOptions {
  /** Starting cube style (the cube view's materials). */
  style: CubeStyle;
  /** Tiles per face edge; defaults to the pinned `GRID_SIZE` (5). */
  gridSize?: number;
  /**
   * Source for the starfield layout, the particle jitter, the background life and the
   * nebula texture; injected so a seeded source makes the whole scene deterministic
   * (defaults to `Math.random`).
   */
  random?: () => number;
  /**
   * The own member's server slot position; defaults to the offline origin `(0, 0)`, so
   * the offline rest pose and intro stay exactly at `(0,0,12)`.
   */
  ownPosition?: Position;
  /** Equipped spaceship appearance (part id per slot); defaults to no parts. */
  appearance?: Record<string, string>;
}

/**
 * Builds the composed scene for one cube level.
 *
 * @param options.style starting cube style (the cube view's materials).
 * @param options.gridSize tiles per face edge; defaults to the pinned `GRID_SIZE` (5).
 * @param options.random source for the starfield layout, the particle jitter, the
 * background life and the nebula texture; injected so a seeded source makes the whole
 * scene deterministic (defaults to `Math.random`).
 * @param options.ownPosition the own member's server slot position; defaults to the
 * offline origin `(0, 0)`, so the offline rest pose and intro stay exactly at `(0,0,12)`.
 */
export function createSceneView(options: SceneViewOptions): SceneView {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const random = options.random ?? Math.random;

  const scene = new Scene();

  const starfield: Starfield = createStarfield(random);
  const ambientLight = new AmbientLight(
    0xffffff,
    AMBIENT_INTENSITY * Math.min(Math.max(starfield.averageBrightness, AMBIENT_INTENSITY_MIN), AMBIENT_INTENSITY_MAX),
  );
  const keyLight = new DirectionalLight(0xffffff, KEY_INTENSITY);
  keyLight.position.set(KEY_LIGHT_POSITION.x, KEY_LIGHT_POSITION.y, KEY_LIGHT_POSITION.z);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(KEY_SHADOW_MAP_SIZE, KEY_SHADOW_MAP_SIZE);
  keyLight.shadow.bias = KEY_SHADOW_BIAS;
  keyLight.shadow.normalBias = KEY_SHADOW_NORMAL_BIAS;
  keyLight.shadow.radius = KEY_SHADOW_RADIUS;
  /** The own cube's world position on the flat plane (z = 0). */
  const cubePosition = new Vector3(
    options.ownPosition?.x ?? 0,
    options.ownPosition?.y ?? 0,
    0,
  );
  let cube: CubeView = createCubeView(options.style, gridSize);
  cube.group.position.copy(cubePosition);
  const particles: ParticleSystem = createParticleSystem(random);
  // Impact and targeting are children of the existing particle group, so the scene child
  // list stays 9 (10 with a remote world) while countObjects grows by +5 (impact +2,
  // targeting +3; AC-47/F2).
  const impact: ImpactEffects = createImpactEffects(random);
  const targeting: Targeting = createTargeting();
  particles.group.add(impact.group, targeting.group);
  // Own-ship appearance (AC-17/AC-25): the constructor's record is v3-normalized once, and
  // the shot style it selects is applied through T10's `applyShotStyle` right away, so the
  // first shot captures the equipped geometry/muzzle even before the first snapshot.
  const initialAppearance = normalizeAppearanceV3(options.appearance ?? {});
  const spaceship: Spaceship = createSpaceship(initialAppearance);
  spaceship.applyShotStyle(shotStyleForPart(initialAppearance.shot ?? 'shot-default'));
  const qualityPolicy: QualityPolicy = createQualityPolicy();
  const backgroundLife: BackgroundLife = createBackgroundLife(random);
  // Created after the starfield, the particle pool and the background life so their seeded
  // draw sequences stay unchanged (AC-16). The backdrop owns the nebula `DataTexture` the
  // scene renders as its background, replacing the old black `Color` (AC-10).
  const cosmicBackdrop: CosmicBackdrop = createCosmicBackdrop(random);
  scene.background = cosmicBackdrop.nebulaTexture;

  scene.add(ambientLight, keyLight, starfield.points, cube.group, particles.group, spaceship.group, spaceship.shotsGroup, backgroundLife.group, cosmicBackdrop.group);

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(cubePosition.x, cubePosition.y, REST_Z);
  camera.lookAt(cubePosition.x, cubePosition.y, 0);

  // Anchor the decorative backdrop at construction so the first rendered frame already has
  // the pinned right-side comet/hero composition from this slot (AC-11, AC-17). The group
  // follows the camera plus the presentation-only offsets; z stays 0, so the children's
  // local z remains world depth.
  cosmicBackdrop.group.position.set(
    camera.position.x + COSMIC_ANCHOR_OFFSET_X,
    camera.position.y + COSMIC_ANCHOR_OFFSET_Y,
    0,
  );

  /**
   * The camera pose the starfield anchors to. The anchor holds the camera's live vectors
   * (plan D-7), so it follows every flight — including the lateral travel — with zero
   * per-frame allocation.
   */
  const starfieldAnchor: StarfieldAnchor = {
    position: camera.position,
    quaternion: camera.quaternion,
  };

  /** Style of the cube view currently in the scene (the rebuild step compares it). */
  let currentStyle = options.style;
  /** Grid edge of the cube view currently in the scene (the rebuild step compares it). */
  let currentGridSize = gridSize;
  /** Style of a `levelChanged` intent awaiting its snapshot (spec AC-3: pending rebuild). */
  let pendingLevelChanged: CubeStyle | null = null;
  /** Latest motion setting; decides the removal countdown and the instant pop mode. */
  let reducedMotion = false;
  /** Starfield travel input kept for `update` — 0..1, 0 outside a travel phase. */
  let travelProgress = 0;
  /** Phase of the previous snapshot (detects the travel-start transition). */
  let lastPhase: Phase | null = null;
  /** The finished cube's world position, captured when the travel phase starts. */
  const travelFrom = new Vector3();
  /** The drawn direction of the running travel, captured with {@link travelFrom}. */
  let travelDirection: TravelDirection | null = null;
  /** The live remote-cube world (built after `welcome`); `null` offline / before welcome. */
  let world: WorldView | null = null;
  /**
   * The lazy `remote-ships` manager group (AC-22): created on the first mount and removed
   * with the last disposal, so a scene with no spectated ship keeps the accepted
   * 135/146/210/322 object counts exactly.
   */
  let remoteShips: Group | null = null;
  /** The one mounted remote ship (the spectated member's), or `null` (AC-15). */
  let remoteShip: RemoteShip | null = null;
  /** The member id the last {@link SceneView.setSpectatedMember} asked for. */
  let spectatedId: string | null = null;
  /** Kind of the running travel — the spectate/return flight gate for mounting (AC-15). */
  let retainedTravelKind: TravelKind | null = null;
  /** The tier's hidden cursor meshes, forwarded to the remote ship each frame (AC-22). */
  let hiddenCursorMeshes: readonly string[] = [];
  /** Preallocated AC-20 fallback target for a removal whose tile is already gone. */
  const remoteTargetScratch = new Vector3();
  /** A `worldEntered` replacement waiting for the next level midpoint (AC-12). */
  let pendingWorld: SceneWorld | null = null;
  /** The last `spectate` target's rest position: the camera rests over it while spectating. */
  let spectateTarget: Vector3 | null = null;
  /** The snapshot's spectating flag (drives the playing rest pose). */
  let spectating = false;
  const faceRemovals = new Map<FaceId, FaceRemoval>();
  let pointerNdc = { x: 0, y: 0 };
  let hasPointer = false;
  /** Hovered mini-cube id (null = miss); T10 resolves it once per frame. */
  let hoverTarget: MiniCubeId | null = null;
  /** Previous snapshot's level index: a rise starts exactly one fly-by (AC-40). */
  let lastLevelIndex: number | null = null;
  /** Last applied quality matrix inputs (tier + reduced motion). */
  let appliedQualityTier: QualityTier | null = null;
  let appliedQualityReduced: boolean | null = null;
  interface PendingExplosion {
    intent: Extract<EffectIntent, { kind: 'explosion' }>;
    origin: Vector3;
    normal: Vector3;
    remainingMs: number;
  }
  const pendingExplosions: PendingExplosion[] = [];
  let retainedFrameTime = 0;
  let lastAppliedAppearance: Record<string, string> = initialAppearance;
  const instanceMatrix = new Matrix4();
  const introPosition = new Vector3();
  const introTarget = new Vector3();
  const travelPosition = new Vector3();
  const travelTarget = new Vector3();
  let disposed = false;

  /**
   * World-space origin of the instance an explosion belongs to. `hideMiniCube` validated
   * the id (and keeps the tile's position through the pop), so the index is on the grid;
   * the cube's world matrix carries the current orientation and world position.
   */
  function instanceOrigin(mesh: InstancedMesh, id: MiniCubeId): Vector3 {
    const [, rowText, colText] = id.split(':');
    const index = Number(rowText) * currentGridSize + Number(colText);
    cube.group.updateMatrixWorld(true);
    mesh.getMatrixAt(index, instanceMatrix);
    instanceMatrix.premultiply(cube.group.matrixWorld);
    return new Vector3().setFromMatrixPosition(instanceMatrix);
  }

  /**
   * World-space outward normal of a face: the group-space {@link FACE_NORMALS} entry turned
   * by the cube's current orientation, with the quarter-turn trig residue snapped away so
   * the burst offset stays exactly assertable (spec AC-3).
   */
  function worldFaceNormal(faceId: FaceId): Vector3 {
    cube.group.updateMatrixWorld(true);
    const normal = FACE_NORMALS[faceId].clone().transformDirection(cube.group.matrixWorld);
    return snapToQuarterTurns(normal);
  }

  /**
   * One explosion: the tile starts its pop, and its burst plays {@link BURST_ORIGIN_OFFSET}
   * in front of the clicked surface so the particles read as blowing towards the camera.
   * Origin and normal are read *before* the hide, so the pop can never affect the burst.
   */
  function applyExplosion(
    intent: Extract<EffectIntent, { kind: 'explosion' }>,
    nowMs: number,
  ): void {
    const mesh = cube.faces.get(intent.faceId);
    if (mesh === undefined) {
      // A face whose instances are already gone has no origin left; the burst falls back to
      // the cube centre (no normal, no offset) rather than producing a NaN position.
      cube.hideMiniCube(intent.id, reducedMotion);
      particles.spawn(intent.burst, new Vector3(), nowMs);
      impact.spawnPop(new Vector3(), new Vector3(0, 0, 1), nowMs);
      return;
    }
    const origin = instanceOrigin(mesh, intent.id);
    const normal = worldFaceNormal(intent.faceId);
    cube.hideMiniCube(intent.id, reducedMotion);
    // The three impact pools start on the tile surface: the shards and the white core at
    // origin + normal · 0.02, the embers/smoke 0.05 in front; the spark burst keeps the
    // accepted 0.5 outward offset.
    impact.spawnPop(origin, normal, nowMs);
    origin.addScaledVector(normal, BURST_ORIGIN_OFFSET);
    particles.spawn(intent.burst, origin, nowMs);
  }

  function applyDeferredExplosion(
    intent: Extract<EffectIntent, { kind: 'explosion' }>,
    origin: Vector3,
    normal: Vector3,
  ): void {
    const mesh = cube.faces.get(intent.faceId);
    if (mesh === undefined) {
      cube.hideMiniCube(intent.id, reducedMotion);
      particles.spawn(intent.burst, new Vector3(), retainedFrameTime);
      impact.spawnPop(new Vector3(), new Vector3(0, 0, 1), retainedFrameTime);
      return;
    }
    const burstOrigin = origin.clone();
    cube.hideMiniCube(intent.id, reducedMotion);
    impact.spawnPop(origin, normal, retainedFrameTime);
    burstOrigin.addScaledVector(normal, BURST_ORIGIN_OFFSET);
    particles.spawn(intent.burst, burstOrigin, retainedFrameTime);
  }

  /**
   * One cleared face: with no plate left to fade (spec AC-2), the face stays in place for
   * the active profile's `faceFadeMs` — long enough for its last tile's 160 ms pop — and is
   * then detached and disposed by {@link advanceFaceRemovals}. Nothing about the material changes.
   */
  function applyFaceCleared(faceId: FaceId): void {
    if (faceRemovals.has(faceId)) {
      return;
    }
    faceRemovals.set(faceId, { elapsedMs: 0, durationMs: timingsFor(reducedMotion).faceFadeMs });
  }

  /** Sets the camera to the rest pose over a world-plane point (AC-3). */
  function applyRestAt(x: number, y: number): void {
    camera.position.set(x, y, REST_Z);
    camera.lookAt(x, y, 0);
  }

  /** Sets the camera to the rest pose over the own cube (AC-3). */
  function applyRestPose(): void {
    applyRestAt(cubePosition.x, cubePosition.y);
  }

  /**
   * The rest pose the current mode rests over: the spectated member's cube while
   * spectating, the own cube otherwise (spec § 6).
   */
  function applyCurrentRestPose(): void {
    if (spectating && spectateTarget !== null) {
      applyRestAt(spectateTarget.x, spectateTarget.y);
      return;
    }
    applyRestPose();
  }

  /** Builds a remote world; a roster that violates the server capacity is disposed at once. */
  function buildWorld(state: SceneWorld): WorldView {
    const built = createWorldView({ maxUsers: state.maxUsers, random });
    try {
      built.applyRoster(state.roster);
    } catch (error) {
      built.dispose();
      throw error;
    }
    return built;
  }

  /** Disposes the live remote world exactly once and detaches it from the scene. */
  function disposeWorld(): void {
    if (world === null) {
      return;
    }
    const previous = world;
    world = null;
    scene.remove(previous.group);
    previous.dispose();
  }

  /**
   * Mounts the one spectated member's ship under the lazy `remote-ships` manager (AC-15).
   * The manager is created on the first mount only, so a scene without a spectated ship
   * keeps the accepted object counts exactly (AC-22).
   */
  function mountRemoteShip(member: MemberState): void {
    if (remoteShips === null) {
      remoteShips = new Group();
      remoteShips.name = 'remote-ships';
      scene.add(remoteShips);
    }
    const ship = createRemoteShip(member);
    remoteShips.add(ship.group);
    remoteShip = ship;
    // Apply the current tier list and motion setting before the first frame, so a ship
    // mounted on a medium/low tier never renders its hidden detail meshes for a frame.
    ship.update(0, reducedMotion, hiddenCursorMeshes);
  }

  /**
   * Unmounts and disposes the live remote ship exactly once, then removes the now-empty
   * `remote-ships` manager from the scene (AC-15, AC-22). Every disposal path
   * (`null`, `memberLeft`, `welcome`/`worldEntered`, scene disposal) funnels through here.
   */
  function disposeRemoteShip(): void {
    if (remoteShip !== null) {
      const ship = remoteShip;
      remoteShip = null;
      ship.dispose();
    }
    if (remoteShips !== null) {
      remoteShips.clear();
      scene.remove(remoteShips);
      remoteShips = null;
    }
  }

  /** True while the camera is in a spectate/return flight — no ship is shown mid-flight. */
  function inCameraOnlyFlight(): boolean {
    return (
      lastPhase === 'travel' &&
      (retainedTravelKind === 'spectate' || retainedTravelKind === 'return')
    );
  }

  /**
   * Resolves the AC-20 shot target for one removal: the removed tile's world origin while it
   * is still live, or the member's fallback point `(px, py, 2.75)` when the tile is already
   * hidden/unknown. `null` when the member left the world in between.
   */
  function removalTargetFor(playerId: string, id: string): Vector3 | null {
    const origin = world?.tileOrigin(playerId, id) ?? null;
    if (origin !== null) {
      return origin;
    }
    const member = world?.member(playerId) ?? null;
    if (member === null) {
      return null;
    }
    const fallback = remoteShipFallbackTarget(member.position);
    return remoteTargetScratch.set(fallback.x, fallback.y, fallback.z);
  }

  /**
   * Re-skins the mounted ship from the world's authoritative member copy (T12/AC-17): used
   * by roster refreshes, where the appearance is state, not an event. A no-op without a ship;
   * `applyAppearance` itself is idempotent for an unchanged record.
   */
  function reskinMountedMember(): void {
    if (remoteShip === null) {
      return;
    }
    const member = world?.member(remoteShip.playerId) ?? null;
    if (member !== null) {
      remoteShip.applyAppearance(member.appearance ?? {});
    }
  }

  /**
   * Enters a server world (welcome/resume): the fresh world is built first (so a rejected
   * roster leaves the current world intact), then the previous world is disposed exactly
   * once, the own cube moves to the server position and the pending swap is cleared.
   */
  function enterServerWorld(state: SceneWorld): void {
    if (disposed) {
      return;
    }
    const replacement = buildWorld(state);
    disposeWorld();
    disposeRemoteShip();
    spectatedId = null;
    pendingWorld = null;
    spectateTarget = null;
    cubePosition.set(state.ownPosition.x, state.ownPosition.y, 0);
    cube.group.position.copy(cubePosition);
    world = replacement;
    scene.add(world.group);
  }

  /**
   * Applies a queued cross-server move at the level midpoint: the old world is disposed
   * exactly once and the new one is built from the new roster (AC-12). The own cube's
   * final position is the server-assigned slot of the target world.
   */
  function applyPendingWorldSwap(): void {
    const next = pendingWorld;
    if (next === null) {
      return;
    }
    pendingWorld = null;
    const replacement = buildWorld(next);
    disposeWorld();
    // The mounted ship belonged to the world being replaced: unmount it exactly once here,
    // at the same midpoint that rebuilds the remote cubes (AC-15).
    disposeRemoteShip();
    spectatedId = null;
    cubePosition.set(next.ownPosition.x, next.ownPosition.y, 0);
    cube.group.position.copy(cubePosition);
    world = replacement;
    scene.add(world.group);
  }

  /**
   * The pinned rebuild step (spec AC-3). Runs exactly once when a `levelChanged` is pending
   * or the snapshot's style id / grid size no longer matches the live cube view: the old
   * view is disposed exactly once, the world position advances to the snapshot's target
   * (the drawn direction's offset offline, the server-assigned destination online — a
   * style/grid reconciliation rebuilds in place), and the fresh view is built at the
   * snapshot's style and grid size. A queued `worldEntered` swap is applied here, at the
   * level midpoint, after the own cube has moved.
   */
  function rebuildCubeIfNeeded(snapshot: EngineSnapshot): void {
    const pending = pendingLevelChanged;
    const styleChanged = snapshot.style.id !== currentStyle.id;
    const gridChanged = snapshot.gridSize !== currentGridSize;
    if (pending === null && !styleChanged && !gridChanged) {
      return;
    }
    if (pending !== null) {
      const kind = snapshot.travelKind ?? null;
      const destination = snapshot.travelDestination ?? null;
      if (kind === 'nextLevel' && destination !== null) {
        // Destination-driven online advance: the server assigned the slot (AC-12).
        cubePosition.set(destination.x, destination.y, 0);
      } else if (kind === 'spectate' || kind === 'return') {
        // Camera-only flights never move the own cube.
      } else {
        // `travelDirection` is null outside a travel (defensive): the offset is then zero.
        const offset =
          snapshot.travelDirection === null
            ? null
            : TRAVEL_DIRECTION_OFFSETS[snapshot.travelDirection];
        cubePosition.x += offset === null ? 0 : offset.x;
        cubePosition.y += offset === null ? 0 : offset.y;
      }
    }
    const previous = cube;
    // A pending removal belongs to the cube that is leaving; the new cube is untouched.
    faceRemovals.clear();
    // The hovered tile belonged to the old cube: a miss until the next pick.
    hoverTarget = null;
    targeting.setHoverTarget(null, null);
    cube = createCubeView(snapshot.style, snapshot.gridSize);
    cube.group.position.copy(cubePosition);
    currentStyle = snapshot.style;
    currentGridSize = snapshot.gridSize;
    pendingLevelChanged = null;
    scene.remove(previous.group);
    scene.add(cube.group);
    previous.dispose();
    if (pending !== null) {
      // The world swap rides the same level-change midpoint: the old world is disposed
      // exactly once and the new roster is built at the server-assigned target position.
      // A style/grid reconciliation (no level change) never swaps worlds.
      applyPendingWorldSwap();
    }
  }

  /**
   * The intro dolly, the travel flights and the rest pose over the current cube
   * (AC-2/AC-3, AC-12, AC-17), plus the starfield travel input the travel phase drives
   * (AC-1/AC-3).
   */
  function applyCamera(snapshot: EngineSnapshot): void {
    const progress = Math.min(1, Math.max(0, snapshot.phaseProgress));
    const kind = snapshot.travelKind ?? null;
    const destination = snapshot.travelDestination ?? null;

    // Capture the flight origin on the travel-start transition, before anything can move
    // `cubePosition` (the midpoint rebuild happens later in this same function's frame):
    // neither the lateral offset nor a destination may be counted twice. A return flight
    // starts from the rest the camera currently holds (the spectated cube), the others
    // from the own cube.
    if (snapshot.phase === 'travel' && lastPhase !== 'travel') {
      const restOrigin = spectateTarget;
      if (restOrigin !== null && (kind === 'return' || spectating)) {
        // A return (or a selection while already spectating) starts from the rest the
        // camera currently holds: the spectated member's cube.
        travelFrom.copy(restOrigin);
      } else {
        travelFrom.copy(cubePosition);
      }
      travelDirection = snapshot.travelDirection;
      if (kind === 'spectate' && destination !== null) {
        spectateTarget = new Vector3(destination.x, destination.y, 0);
      }
    }

    if (snapshot.reducedMotion) {
      // No fly-through and no expansion: the camera rests over its target at every
      // progress. A camera-only flight is an instant positional swap (AC-17); a level
      // travel swaps the cube (and therefore the rest pose) at the midpoint.
      travelProgress = 0;
      if (
        snapshot.phase === 'travel' &&
        (kind === 'spectate' || kind === 'return') &&
        destination !== null
      ) {
        applyRestAt(destination.x, destination.y);
        return;
      }
      applyCurrentRestPose();
      return;
    }
    if (snapshot.phase === 'intro') {
      travelProgress = 0;
      introCameraPose(progress, introPosition, introTarget);
      // The dolly targets the own server slot: offline the position is (0,0), so the
      // accepted (0,0,60) → (0,0,12) table is unchanged (AC-24).
      camera.position.set(
        introPosition.x + cubePosition.x,
        introPosition.y + cubePosition.y,
        introPosition.z,
      );
      camera.lookAt(
        introTarget.x + cubePosition.x,
        introTarget.y + cubePosition.y,
        introTarget.z,
      );
      return;
    }
    if (snapshot.phase === 'travel') {
      if (kind === 'nextLevel') {
        if (destination === null) {
          // The online hold: no destination yet, so no flight starts. The camera stays at
          // the rest pose with progress 0 (Q-T8-2, AC-12).
          travelProgress = 0;
          applyCurrentRestPose();
          return;
        }
        travelProgress = progress;
        writeTravelPose(
          progress,
          travelFrom.x,
          travelFrom.y,
          destination.x - travelFrom.x,
          destination.y - travelFrom.y,
          travelPosition,
          travelTarget,
        );
        camera.position.copy(travelPosition);
        camera.lookAt(travelTarget);
        return;
      }
      if (kind === 'spectate' || kind === 'return') {
        if (destination === null) {
          // Defensive: a camera-only flight always carries its server destination.
          travelProgress = 0;
          applyCurrentRestPose();
          return;
        }
        travelProgress = progress;
        const pose = spectateTravelPose(travelFrom, destination, progress);
        camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        camera.lookAt(pose.lookTarget.x, pose.lookTarget.y, pose.lookTarget.z);
        return;
      }
      travelProgress = progress;
      // Offline directional flight from the captured origin: lateral toward the drawn
      // offset while the depth keeps the retained symmetric swing (12 → 90 → 12).
      travelCameraPose(
        progress,
        travelFrom.x,
        travelFrom.y,
        travelDirection,
        travelPosition,
        travelTarget,
      );
      camera.position.copy(travelPosition);
      camera.lookAt(travelTarget);
      return;
    }
    travelProgress = 0;
    // A skip can leave the intro mid-pan; the rest pose is the position *and* the
    // orientation, so the camera always lands looking straight at the current cube.
    applyCurrentRestPose();
  }

  /** Advances the face-removal countdowns; a completed countdown removes (and disposes) its face. */
  function advanceFaceRemovals(dtMs: number): void {
    const advanceMs = Math.max(0, dtMs);
    for (const [faceId, removal] of faceRemovals) {
      removal.elapsedMs += advanceMs;
      if (removal.elapsedMs >= removal.durationMs) {
        faceRemovals.delete(faceId);
        cube.removeFace(faceId);
      }
    }
  }

  /**
   * Applies the adaptive feature matrix to every consumer when the tier or the motion
   * setting changed (AC-52). Reduced motion is authoritative: it turns off every motion
   * layer regardless of tier while the tier may still hide static detail. The key light's
   * shadow budget is static GPU cost, so the tier scales its map (2048 → 1024) or turns
   * the shadow pass off entirely at low (AC-6, AC-7, AC-8).
   */
  function applyQuality(): void {
    const tier = qualityPolicy.getTier();
    if (appliedQualityTier === tier && appliedQualityReduced === reducedMotion) {
      return;
    }
    appliedQualityTier = tier;
    appliedQualityReduced = reducedMotion;
    const features = qualityFeatures(tier, reducedMotion);
    // The remote ship consumes the same tier list each frame (T12/AC-22); store the exact
    // array the feature matrix hands out so no per-frame list is rebuilt.
    hiddenCursorMeshes = features.hiddenCursorMeshes;
    spaceship.setTrailEnabled(features.trail);
    spaceship.setCursorMotionEnabled(features.cursorMotion);
    spaceship.setHiddenMeshes(features.hiddenCursorMeshes);
    spaceship.setShotFxEnabled(features.shotFx);
    targeting.setReticleEnabled(features.reticle);
    // The impact module owns the three per-pop pools: green shards, the white-hot core and
    // the ember/smoke burst (AC-7). The default matrix is inert for the explosion until a
    // tier is applied here.
    impact.setFeatures({
      shards: features.impactShards,
      flash: features.explosionFlash,
      embers: features.explosionEmbers,
      smoke: features.explosionSmoke,
    });
    particles.setSparkLimit(features.sparks);
    // The key light is the scene's only shadow caster. A tier change to the map edge only
    // takes effect once the live target is released; three.js allocates the new one on the
    // next shadow render (spec A-4). At low the size is 0: the shadow pass is off and the
    // existing map is neither resampled nor reallocated (AC-8).
    const shadowMapSize = features.shadowMapSize;
    keyLight.castShadow = shadowMapSize > 0;
    if (shadowMapSize > 0 && keyLight.shadow.mapSize.width !== shadowMapSize) {
      keyLight.shadow.map?.dispose();
      keyLight.shadow.map = null;
      keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    }
  }
  applyQuality();

  /**
   * Starts the level-complete fly-by exactly once per completion (AC-40). Production
   * detects the completion here, on the `levelIndex` rise carried by the same
   * `EngineSnapshot` that mounts the App's `LevelCompleteBanner`; this hook is also the
   * integration-test seam. Reduced motion never rolls the ship, and a running roll is
   * never restarted by a repeated trigger.
   */
  function triggerLevelFlyBy(): void {
    if (disposed || reducedMotion || spaceship.isFlyingBy()) {
      return;
    }
    spaceship.startFlyBy();
  }

  const view: SceneView = {
    scene,
    camera,

    get cubeView(): CubeView {
      // Rebuild-aware: the rebuild step re-assigns the binding, so the getter always
      // answers with the cube view the scene currently holds (never a stale one).
      return cube;
    },

    get worldView(): WorldView | null {
      return world;
    },

    cosmicBackdrop,

    setPointerTarget(ndcX: number, ndcY: number): void {
      if (disposed) {
        return;
      }
      const clamp = (value: number): number => Math.min(1, Math.max(-1, value));
      pointerNdc = { x: clamp(ndcX), y: clamp(ndcY) };
      hasPointer = true;
    },

    setHoverTarget(id: MiniCubeId | null): void {
      if (disposed) {
        return;
      }
      hoverTarget = id;
      targeting.setHoverTarget(id, cube);
    },

    triggerFlyBy(): void {
      triggerLevelFlyBy();
    },

    getQualityTier(): QualityTier {
      return qualityPolicy.getTier();
    },

    setQualityTierForTesting(tier: QualityTier): void {
      if (disposed) {
        return;
      }
      qualityPolicy.setTier(tier);
      applyQuality();
    },

    get shots(): readonly Shot[] {
      return spaceship.shots;
    },

    get lastFrameTime(): number {
      return retainedFrameTime;
    },

    get lastAppearance(): Record<string, string> {
      return { ...lastAppliedAppearance };
    },

    get lastAppliedAppearance(): Record<string, string> {
      return { ...lastAppliedAppearance };
    },

    get appliedAppearance(): Record<string, string> {
      return { ...lastAppliedAppearance };
    },

    enterWorld(state: SceneWorld): void {
      enterServerWorld(state);
    },

    queueWorldSwap(state: SceneWorld): void {
      if (disposed) {
        return;
      }
      pendingWorld = {
        maxUsers: state.maxUsers,
        ownPosition: { x: state.ownPosition.x, y: state.ownPosition.y },
        roster: [...state.roster],
      };
    },

    applyWorldMessage(msg: ServerMessage): void {
      if (disposed) {
        return;
      }
      // Resolve the AC-20 shot target *before* the world applies the removal: after the
      // apply the tile is hidden and `tileOrigin` answers `null`, which selects the fallback.
      const ship = remoteShip;
      let target: Vector3 | null = null;
      if (ship !== null) {
        if (msg.type === 'miniCubeRemoved' && msg.playerId === ship.playerId) {
          target = removalTargetFor(ship.playerId, msg.id);
        } else if (msg.type === 'miniCubesRemoved' && msg.playerId === ship.playerId) {
          const firstId = msg.ids[0];
          target = firstId === undefined ? null : removalTargetFor(ship.playerId, firstId);
        }
      }
      world?.applyMessage(msg);
      if (target !== null && ship !== null) {
        // At most one shot per member message; the ship's own 90 ms interval and two-shot
        // cap decide acceptance, and a dropped shot starts no recoil (AC-20).
        ship.fire(target, retainedFrameTime);
      }
      if (msg.type === 'memberLeft' && msg.playerId === spectatedId) {
        // The spectated member left: dispose the ship exactly once and forget the request,
        // so a later rejoin with the same id can mount again (AC-15).
        disposeRemoteShip();
        spectatedId = null;
        return;
      }
      if (
        remoteShip !== null &&
        msg.type === 'memberJoined' &&
        msg.member.playerId === remoteShip.playerId
      ) {
        // A roster refresh re-skins the mounted model in place (no remount, idempotent): the
        // member's public projection is the authority for their ship (AC-15/AC-17/AC-26).
        reskinMountedMember();
      }
      if (
        remoteShip !== null &&
        msg.type === 'levelAdvanced' &&
        msg.playerId === remoteShip.playerId
      ) {
        // The member kept their appearance across the advance: re-apply the stored copy.
        reskinMountedMember();
      }
    },

    setSpectatedMember(playerId: string | null): void {
      if (disposed) {
        return;
      }
      if (playerId === spectatedId && (playerId === null || remoteShip !== null)) {
        // Already showing exactly this member: no remount, no second dispose (AC-15).
        return;
      }
      disposeRemoteShip();
      spectatedId = playerId;
      if (playerId === null) {
        return;
      }
      if (world === null || inCameraOnlyFlight()) {
        // No ship before the first `welcome` and none during a spectate/return flight: a
        // later call (the arrival) mounts it once the world and camera are settled.
        return;
      }
      const member = world.member(playerId);
      if (member === null) {
        // Unknown id, the own member, or a member whose cube is not in the rendered world.
        return;
      }
      mountRemoteShip(member);
    },

    setSpectatedAppearance(playerId: string, appearance: Record<string, string>): void {
      if (disposed || remoteShip === null || remoteShip.playerId !== playerId) {
        return;
      }
      remoteShip.applyAppearance(appearance);
    },

    applyIntents(intents: EffectIntent[], nowMs: number): void {
      retainedFrameTime = nowMs;
      for (const intent of intents) {
        switch (intent.kind) {
          case 'explosion':
            if (reducedMotion) {
              applyExplosion(intent, nowMs);
            } else {
              const mesh = cube.faces.get(intent.faceId);
              let origin: Vector3;
              let normal: Vector3;
              if (mesh === undefined) {
                origin = new Vector3();
                normal = new Vector3();
              } else {
                origin = instanceOrigin(mesh, intent.id);
                normal = worldFaceNormal(intent.faceId);
              }
              const start = spaceship.getPosition();
              spaceship.spawnShot(start, origin);
              pendingExplosions.push({
                intent,
                origin,
                normal,
                remainingMs: SHOT_TRAVEL_MS,
              });
            }
            break;
          case 'faceCleared':
            applyFaceCleared(intent.faceId);
            break;
          case 'levelChanged':
            // Pending: the next snapshot carries the new style, grid size and direction.
            pendingLevelChanged = intent.style;
            break;
          case 'travelStarted':
            // Travel lives in the snapshot: the directional camera flight and the starfield
            // scale follow `phaseProgress`, so the one-shot marker needs no state of its own.
            break;
        }
      }
    },

    applySnapshot(snapshot: EngineSnapshot, nowMs: number): void {
      retainedFrameTime = nowMs;
      // The frame time stays in the pinned `SceneView` signature for the loop; every value
      // applied here comes from the snapshot (removals/pops are driven by `update`'s dt).
      // Pinned order: motion setting → rebuild → camera → orientation → reduced settle.
      reducedMotion = snapshot.reducedMotion;
      spectating = snapshot.spectating ?? false;
      // The level-complete signal (AC-40): the same `levelIndex` rise that mounts the
      // App's banner starts exactly one fly-by here, before the rebuild/camera step.
      const levelIndex = snapshot.levelIndex;
      if (lastLevelIndex !== null && levelIndex > lastLevelIndex) {
        triggerLevelFlyBy();
      }
      lastLevelIndex = levelIndex;
      const nextAppearance = snapshot.customization?.appearance;
      // AC-17/AC-25: the own ship renders the v3-normalized projection, and the `shot` entry
      // (or its fallback) selects the shot style through T10's `applyShotStyle`.
      const nextRecord: Record<string, string> = normalizeAppearanceV3(nextAppearance ?? {});
      const appearanceChanged =
        Object.keys(nextRecord).length !== Object.keys(lastAppliedAppearance).length ||
        Object.keys(nextRecord).some(
          (key) => nextRecord[key] !== lastAppliedAppearance[key],
        );
      if (appearanceChanged) {
        spaceship.applyAppearance(nextRecord);
        spaceship.applyShotStyle(shotStyleForPart(nextRecord.shot ?? 'shot-default'));
        lastAppliedAppearance = nextRecord;
      }
      rebuildCubeIfNeeded(snapshot);
      applyCamera(snapshot);
      const from = snapshot.rotationFrom ?? snapshot.orientation;
      const progress = snapshot.rotationFrom === null ? 1 : snapshot.rotationProgress;
      const rotation = interpolateRotation(from, snapshot.orientation, progress);
      // `game/rotation.ts` pins the frame: `rotation.set(pitch, yaw, 0)` in the default
      // three.js 'XYZ' order puts `frontFace(orientation)` at the camera.
      cube.group.rotation.set(rotation.pitch, rotation.yaw, 0);
      if (snapshot.reducedMotion) {
        // A live switch to reduced motion settles any remaining conceal state and
        // re-applies the authoritative motion matrix (AC-48/AC-52).
        cube.settlePops();
      }
      applyQuality();
      lastPhase = snapshot.phase;
      retainedTravelKind = snapshot.travelKind ?? null;
    },

    update(dtMs: number): void {
      // The adaptive policy consumes exactly one frame delta per rendered frame (AC-52).
      qualityPolicy.pushFrameTime(dtMs);
      applyQuality();
      // The travel input persists between snapshots: a frame that only advances time
      // keeps the current expansion and the swirl (see `starfield.update`). The anchor is
      // the live camera pose, so the backdrop stays camera-centred in every phase.
      spaceship.update(camera, pointerNdc.x, pointerNdc.y, hasPointer, dtMs, reducedMotion);
      // Refresh the lock transform each frame so a rotating cube keeps the outline on its
      // tile; the target itself is resolved by the session at most once per frame.
      targeting.setHoverTarget(hoverTarget, cube);
      targeting.update(dtMs, reducedMotion);
      const advanceMs = Math.max(0, dtMs);
      const completedShots = spaceship.updateShots(dtMs);
      void completedShots;
      // Age the live pools before spawning this frame's deferred explosions, so a burst
      // that starts now begins its timeline at elapsed 0 (no double-aged first frame).
      particles.update(dtMs);
      impact.update(dtMs);
      // Advance the live destroy records *before* this frame's deferred explosions spawn:
      // a pop that starts now writes its hide frame (scale 1, brightness 3) and receives
      // its first +dt on the next frame, so the arrival frame shows the flash (AC-7).
      cube.update(dtMs);
      for (let index = pendingExplosions.length - 1; index >= 0; index -= 1) {
        const pending = pendingExplosions[index]!;
        pending.remainingMs = Math.max(0, pending.remainingMs - advanceMs);
        if (pending.remainingMs <= 0) {
          applyDeferredExplosion(pending.intent, pending.origin, pending.normal);
          pendingExplosions.splice(index, 1);
        }
      }
      backgroundLife.update(dtMs, reducedMotion);
      // The decorative group follows the live camera x/y plus the presentation-only
      // right/up composition offsets before its slow drift; z stays 0 so the pinned child
      // depth is unchanged (AC-11, AC-17).
      cosmicBackdrop.group.position.set(
        camera.position.x + COSMIC_ANCHOR_OFFSET_X,
        camera.position.y + COSMIC_ANCHOR_OFFSET_Y,
        0,
      );
      cosmicBackdrop.update(dtMs, reducedMotion);
      starfield.update(dtMs, travelProgress, starfieldAnchor, reducedMotion);
      advanceFaceRemovals(dtMs);
      // Remote cubes and their pops advance on the same clock, after the own removals.
      // A face whose removal completes this frame drops its destroy records with the
      // detached mesh, so no write ever follows its disposal.
      world?.update(dtMs);
      // The spectated member's ship advances with the same delta and the tier's hidden-mesh
      // list; it never follows the pointer, travels or owns a trail/reticle (AC-19, AC-22).
      remoteShip?.update(dtMs, reducedMotion, hiddenCursorMeshes);
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      faceRemovals.clear();
      pendingExplosions.length = 0;
      // The backdrop owns the texture: detach it from the scene first, then release it.
      scene.background = null;
      cosmicBackdrop.dispose();
      starfield.dispose();
      cube.dispose();
      // Impact/targeting are children of the particle group; release them before the
      // particle system clears that group.
      impact.dispose();
      targeting.dispose();
      particles.dispose();
      disposeWorld();
      // The mounted remote ship (and its lazy manager) is released exactly once (AC-15).
      disposeRemoteShip();
      spaceship.dispose();
      backgroundLife.dispose();
      scene.clear();
    },
  };

  return view;
}

/**
 * NEXUS Engine - 2D/3D Conversion System Types
 * 
 * Tipos e interfaces para el sistema de conversión 2D/3D
 */

// ============================================
// CORE TYPES
// ============================================

/** Vector 2D */
export interface Point2D {
  x: number;
  y: number;
}

/** Vector 3D */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Quaternion */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Color RGB/RGBA */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** UV coordinates */
export interface UV {
  u: number;
  v: number;
}

/** Bounding box 2D */
export interface BoundingBox2D {
  min: Point2D;
  max: Point2D;
}

/** Bounding box 3D */
export interface BoundingBox3D {
  min: Vec3;
  max: Vec3;
}

// ============================================
// INPUT TYPES
// ============================================

/** Input type classification */
export type InputType =
  | 'sketch_single'
  | 'sketch_multi'
  | 'image_single'
  | 'image_multi'
  | 'photo_set'
  | 'video'
  | 'scene_scan';

/** View direction labels */
export type ViewLabel =
  | 'front'
  | 'side_left'
  | 'side_right'
  | 'back'
  | 'top'
  | 'bottom'
  | 'perspective'
  | 'custom';

/** Pipeline types */
export type PipelineType =
  | 'sketch2d_to_3d'
  | 'multiview_sketch'
  | 'image_to_3d'
  | 'multiview_image'
  | 'photogrammetry'
  | 'video_reconstruction'
  | 'scene_reconstruction';

/** Stroke in a sketch */
export interface Stroke {
  id: string;
  points: Point2D[];
  pressures: number[];
  color: RGBA;
  width: number;
  layerId: string;
  closed: boolean;
}

/** Layer in a sketch */
export interface SketchLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokeIds: string[];
}

/** Sketch session */
export interface SketchSession {
  id: string;
  name: string;
  strokes: Map<string, Stroke>;
  layers: Map<string, SketchLayer>;
  activeLayerId: string;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Sketch view (for multi-view) */
export interface SketchView {
  id: string;
  label: ViewLabel;
  angle: number;
  session: SketchSession;
}

/** Imported image data */
export interface ImportedImage {
  id: string;
  source: string;
  file?: File;
  width: number;
  height: number;
  format: string;
  imageData?: ImageData;
  thumbnail?: string;
  metadata: ImageMetadata;
}

/** Image metadata */
export interface ImageMetadata {
  filename?: string;
  size?: number;
  createdAt?: Date;
  exif?: Record<string, unknown>;
}

/** Labeled view for multi-view input */
export interface LabeledView {
  id: string;
  image: ImportedImage;
  label: ViewLabel;
  estimatedAngle: number;
  keypoints?: DetectedKeypoint[];
  descriptor?: Float32Array;
}

/** Video data */
export interface ImportedVideo {
  id: string;
  source: string;
  file?: File;
  duration: number;
  fps: number;
  width: number;
  height: number;
  frames: ExtractedFrame[];
  thumbnail?: string;
}

/** Extracted frame from video */
export interface ExtractedFrame {
  id: string;
  index: number;
  timestamp: number;
  image: ImportedImage;
  blurScore: number;
  isKeyframe: boolean;
  keypoints?: DetectedKeypoint[];
  cameraPose?: EstimatedCameraPose;
}

/** Photo set for photogrammetry */
export interface PhotoSet {
  id: string;
  photos: ImportedImage[];
  coverageReport?: CoverageReport;
  calibrationData?: CalibrationData;
}

// ============================================
// PREPROCESSING TYPES
// ============================================

/** Detected keypoint */
export interface DetectedKeypoint {
  id: string;
  position: Point2D;
  scale: number;
  angle: number;
  response: number;
  octave: number;
}

/** Feature match between images */
export interface FeatureMatch {
  queryKeypointId: string;
  trainKeypointId: string;
  distance: number;
}

/** Silhouette data */
export interface SilhouetteData {
  id: string;
  contours: Contour[];
  holes: Contour[];
  boundingBox: BoundingBox2D;
  center: Point2D;
  area: number;
  sourceImageId: string;
}

/** Contour */
export interface Contour {
  id: string;
  points: Point2D[];
  closed: boolean;
  area: number;
  perimeter: number;
}

/** Edge detection result */
export interface EdgeData {
  id: string;
  edges: Point2D[][];
  strength: number[];
  sourceImageId: string;
}

/** Depth map estimation */
export interface DepthMap {
  id: string;
  width: number;
  height: number;
  data: Float32Array;
  minDepth: number;
  maxDepth: number;
  sourceImageId: string;
}

/** Quality levels */
export type QualityLevel = 'excellent' | 'good' | 'acceptable' | 'poor';

/** Quality issue */
export interface QualityIssue {
  type: QualityIssueType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

export type QualityIssueType =
  | 'low_resolution'
  | 'blurry'
  | 'bad_lighting'
  | 'complex_background'
  | 'insufficient_coverage'
  | 'inconsistent_views'
  | 'missing_angle'
  | 'poor_contrast';

/** Quality report */
export interface QualityReport {
  score: number;
  level: QualityLevel;
  issues: QualityIssue[];
  suggestions: string[];
  canProceed: boolean;
}

/** Coverage report for multi-view */
export interface CoverageReport {
  totalAngle: number;
  gaps: CoverageGap[];
  quality: QualityLevel;
  recommendedAdditionalViews: ViewLabel[];
}

export interface CoverageGap {
  startAngle: number;
  endAngle: number;
  suggestedViews: ViewLabel[];
}

/** Calibration data for camera */
export interface CalibrationData {
  focalLength: number;
  principalPoint: Point2D;
  distortion: number[];
}

/** Estimated camera pose */
export interface EstimatedCameraPose {
  id: string;
  position: Vec3;
  rotation: Quat;
  fov: number;
  aspectRatio: number;
  confidence: number;
}

// ============================================
// INTERPRETATION TYPES
// ============================================

/** Intent categories */
export type IntentCategory =
  | 'human'
  | 'animal'
  | 'character'
  | 'furniture_chair'
  | 'furniture_table'
  | 'furniture_bed'
  | 'furniture_sofa'
  | 'furniture_cabinet'
  | 'vehicle_car'
  | 'vehicle_bike'
  | 'vehicle_other'
  | 'architecture_room'
  | 'architecture_building'
  | 'object_mechanical'
  | 'object_organic'
  | 'object_generic';

/** Intent result */
export interface IntentResult {
  category: IntentCategory;
  confidence: number;
  subcategories: IntentCategory[];
  features: DetectedFeature[];
  explanation: string;
  alternativeSuggestions: IntentCategory[];
}

/** Detected feature */
export interface DetectedFeature {
  type: FeatureType;
  description: string;
  confidence: number;
  location?: BoundingBox2D;
}

export type FeatureType =
  | 'symmetry'
  | 'legs'
  | 'arms'
  | 'head'
  | 'torso'
  | 'wheels'
  | 'flat_surface'
  | 'vertical_support'
  | 'enclosed_space';

/** Shape category */
export type ShapeCategory =
  | 'humanoid'
  | 'quadruped'
  | 'biped'
  | 'furniture'
  | 'vehicle'
  | 'architectural'
  | 'organic'
  | 'mechanical'
  | 'generic';

/** Symmetry axis */
export interface SymmetryAxis {
  type: 'vertical' | 'horizontal' | 'radial';
  confidence: number;
  axis: Point2D[];
}

/** Template suggestion */
export interface TemplateSuggestion {
  id: string;
  templateType: TemplateType;
  templateId: string;
  confidence: number;
  params: TemplateParams;
  previewMeshId?: string;
  reason: string;
}

export type TemplateType =
  | 'human'
  | 'animal'
  | 'chair'
  | 'table'
  | 'bed'
  | 'sofa'
  | 'cabinet'
  | 'vehicle'
  | 'room';

/** Base template parameters */
export interface TemplateParams {
  [key: string]: number | string | boolean;
}

/** Human template parameters */
export interface HumanTemplateParams extends TemplateParams {
  height: number;
  bodyType: 'slim' | 'average' | 'athletic' | 'heavy';
  gender: 'male' | 'female' | 'neutral';
  proportionStyle: 'realistic' | 'stylized' | 'cartoon';
  subdivisions: number;
}

/** Chair template parameters */
export interface ChairTemplateParams extends TemplateParams {
  seatHeight: number;
  seatWidth: number;
  seatDepth: number;
  backrestHeight: number;
  legStyle: 'straight' | 'curved' | 'cross';
  legCount: 4 | 3 | 5;
  armrests: boolean;
  subdivisions: number;
}

/** Table template parameters */
export interface TableTemplateParams extends TemplateParams {
  height: number;
  width: number;
  depth: number;
  topThickness: number;
  legStyle: 'straight' | 'tapered' | 'curved';
  legCount: 4 | 3 | 6;
  subdivisions: number;
}

/** Bed template parameters */
export interface BedTemplateParams extends TemplateParams {
  length: number;
  width: number;
  height: number;
  headboardHeight: number;
  footboardHeight: number;
  frameThickness: number;
  subdivisions: number;
}

// ============================================
// RECONSTRUCTION TYPES
// ============================================

/** Point in 3D space */
export interface Point3D {
  position: Vec3;
  color?: RGBA;
  normal?: Vec3;
  sourceViewIds?: string[];
}

/** Point cloud */
export interface PointCloud {
  id: string;
  points: Point3D[];
  bounds: BoundingBox3D;
  density: number;
  sourcePhotoIds: string[];
}

/** Proxy mesh (rough 3D approximation) */
export interface ProxyMesh {
  id: string;
  vertices: Vec3[];
  faces: Face3[];
  normals?: Vec3[];
  confidence: number;
  isBlockoutReady: boolean;
  sourceId: string;
}

/** Face with 3 indices */
export interface Face3 {
  a: number;
  b: number;
  c: number;
}

/** Face with 4 indices (quad) */
export interface Face4 {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Reconstructed mesh */
export interface ReconstructedMesh {
  id: string;
  vertices: Vec3[];
  faces: Face3[];
  normals: Vec3[];
  uvs: UV[];
  vertexColors?: RGBA[];
  confidence: number;
  quality: QualityLevel;
  sourceViewIds: string[];
  reconstructionMethod: PipelineType;
}

/** Scene segment */
export interface SceneSegment {
  id: string;
  type: SceneSegmentType;
  mesh: ReconstructedMesh;
  bounds: BoundingBox3D;
  confidence: number;
}

export type SceneSegmentType =
  | 'floor'
  | 'ceiling'
  | 'wall'
  | 'furniture'
  | 'object'
  | 'unknown';

/** Reconstructed scene */
export interface ReconstructedScene {
  id: string;
  segments: SceneSegment[];
  cameraPoses: EstimatedCameraPose[];
  bounds: BoundingBox3D;
  quality: QualityLevel;
}

// ============================================
// EDITABLE MESH TYPES
// ============================================

/** Vertex in editable mesh */
export interface EditableVertex {
  id: string;
  position: Vec3;
  normal: Vec3;
  uv: UV;
  color?: RGBA;
  edgeIds: string[];
  faceIds: string[];
  selected: boolean;
}

/** Edge in editable mesh */
export interface EditableEdge {
  id: string;
  vertexIds: [string, string];
  faceIds: string[];
  crease: number;
  sharp: boolean;
  selected: boolean;
}

/** Face in editable mesh */
export interface EditableFace {
  id: string;
  vertexIds: string[];
  edgeIds: string[];
  normal: Vec3;
  materialIndex: number;
  selected: boolean;
}

/** Topology graph */
export interface TopologyGraph {
  vertexAdjacency: Map<string, string[]>;
  edgeAdjacency: Map<string, string[]>;
  faceAdjacency: Map<string, string[]>;
}

/** Mesh attribute data */
export interface MeshAttributes {
  normals: Vec3[];
  uvs: UV[];
  colors: RGBA[];
  weights?: VertexWeight[];
}

/** Vertex weights for skeletal animation */
export interface VertexWeight {
  vertexId: string;
  boneWeights: Array<{ boneId: string; weight: number }>;
}

/** Reconstruction metadata */
export interface ReconstructionMetadata {
  sourceType: InputType;
  sourceId: string;
  pipeline: PipelineType;
  confidence: number;
  qualityLevel: QualityLevel;
  createdAt: Date;
  processingTime: number;
  parameters: Record<string, unknown>;
  version: string;
}

/** Editable mesh */
export interface EditableMeshData {
  id: string;
  name: string;
  vertices: Map<string, EditableVertex>;
  edges: Map<string, EditableEdge>;
  faces: Map<string, EditableFace>;
  topology: TopologyGraph;
  attributes: MeshAttributes;
  materials: string[];
  bounds: BoundingBox3D;
  metadata: ReconstructionMetadata;
}

// ============================================
// EDITABLE OBJECT & SCENE TYPES
// ============================================

/** Transform */
export interface TransformData {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

/** Editable object */
export interface EditableObjectData {
  id: string;
  name: string;
  type: ObjectType;
  meshId?: string;
  transform: TransformData;
  materialIds: string[];
  parentId?: string;
  childrenIds: string[];
  visible: boolean;
  locked: boolean;
  metadata: Record<string, unknown>;
}

export type ObjectType =
  | 'mesh'
  | 'light'
  | 'camera'
  | 'empty'
  | 'group';

/** Editable scene */
export interface EditableSceneData {
  id: string;
  name: string;
  description?: string;
  objects: Map<string, EditableObjectData>;
  meshes: Map<string, EditableMeshData>;
  rootObjectIds: string[];
  environment: EnvironmentData;
  physics: PhysicsData;
  createdAt: Date;
  updatedAt: Date;
}

/** Environment settings */
export interface EnvironmentData {
  skybox?: string;
  ambientColor: RGBA;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor?: RGBA;
  fogNear?: number;
  fogFar?: number;
  fogDensity?: number;
  fogType?: 'linear' | 'exponential';
}

/** Physics settings */
export interface PhysicsData {
  gravity: Vec3;
  fixedTimeStep: number;
  maxSubSteps: number;
}

// ============================================
// CONVERSION SESSION TYPES
// ============================================

/** Conversion session */
export interface ConversionSession {
  id: string;
  inputType: InputType;
  inputs: ConversionInput[];
  status: ConversionStatus;
  progress: number;
  currentStep: string;
  result?: ConversionResult;
  errors: ConversionError[];
  warnings: ConversionWarning[];
  startedAt: Date;
  completedAt?: Date;
}

export type ConversionStatus =
  | 'pending'
  | 'preprocessing'
  | 'interpreting'
  | 'reconstructing'
  | 'postprocessing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Conversion input union */
export type ConversionInput =
  | SketchInput
  | ImageInput
  | VideoInput
  | PhotoSetInput
  | SceneScanInput;

export interface SketchInput {
  type: 'sketch';
  session: SketchSession;
  views?: SketchView[];
}

export interface ImageInput {
  type: 'image';
  image: ImportedImage;
  views?: LabeledView[];
}

export interface VideoInput {
  type: 'video';
  video: ImportedVideo;
}

export interface PhotoSetInput {
  type: 'photo_set';
  photoSet: PhotoSet;
}

export interface SceneScanInput {
  type: 'scene_scan';
  photos: ImportedImage[];
  video?: ImportedVideo;
}

/** Conversion result */
export interface ConversionResult {
  mesh?: EditableMeshData;
  object?: EditableObjectData;
  scene?: EditableSceneData;
  confidence: number;
  qualityLevel: QualityLevel;
  suggestions: string[];
  alternativeResults?: ConversionResult[];
}

/** Conversion error */
export interface ConversionError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
}

/** Conversion warning */
export interface ConversionWarning {
  code: string;
  message: string;
  suggestion: string;
  timestamp: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Generate unique ID */
export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/** Create default Vec3 */
export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

/** Create default Quat */
export function quat(x = 0, y = 0, z = 0, w = 1): Quat {
  return { x, y, z, w };
}

/** Create default RGBA */
export function rgba(r = 1, g = 1, b = 1, a = 1): RGBA {
  return { r, g, b, a };
}

/** Create default UV */
export function uv(u = 0, v = 0): UV {
  return { u, v };
}

/** Create default Point2D */
export function point2D(x = 0, y = 0): Point2D {
  return { x, y };
}

/** Create empty bounding box 3D */
export function emptyBoundingBox3D(): BoundingBox3D {
  return {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
}

/** Merge bounding boxes */
export function mergeBoundingBox3D(a: BoundingBox3D, b: BoundingBox3D): BoundingBox3D {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z),
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z),
    },
  };
}

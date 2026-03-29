export const MODULAR_LAB_MAX_FILE_SIZE = 100 * 1024 * 1024

export const SUPPORTED_MODEL_EXTENSIONS = ['.fbx', '.obj', '.glb', '.gltf'] as const

export const SUPPORTED_MODEL_ACCEPT = SUPPORTED_MODEL_EXTENSIONS.join(',')

export const STANDARD_PARTS = [
  { key: 'head', label: 'Cabeza', category: 'core', connectionTarget: 'neck' },
  { key: 'neck', label: 'Cuello', category: 'core', connectionTarget: 'torso' },
  { key: 'torso', label: 'Torso', category: 'core', connectionTarget: 'pelvis' },
  { key: 'left_arm', label: 'Brazo izquierdo', category: 'core', connectionTarget: 'torso' },
  { key: 'right_arm', label: 'Brazo derecho', category: 'core', connectionTarget: 'torso' },
  { key: 'left_forearm', label: 'Antebrazo izquierdo', category: 'core', connectionTarget: 'left_arm' },
  { key: 'right_forearm', label: 'Antebrazo derecho', category: 'core', connectionTarget: 'right_arm' },
  { key: 'left_hand', label: 'Mano izquierda', category: 'core', connectionTarget: 'left_forearm' },
  { key: 'right_hand', label: 'Mano derecha', category: 'core', connectionTarget: 'right_forearm' },
  { key: 'pelvis', label: 'Pelvis', category: 'core', connectionTarget: 'torso' },
  { key: 'left_leg', label: 'Pierna izquierda', category: 'core', connectionTarget: 'pelvis' },
  { key: 'right_leg', label: 'Pierna derecha', category: 'core', connectionTarget: 'pelvis' },
  { key: 'left_calf', label: 'Pantorrilla izquierda', category: 'core', connectionTarget: 'left_leg' },
  { key: 'right_calf', label: 'Pantorrilla derecha', category: 'core', connectionTarget: 'right_leg' },
  { key: 'left_foot', label: 'Pie izquierdo', category: 'core', connectionTarget: 'left_calf' },
  { key: 'right_foot', label: 'Pie derecho', category: 'core', connectionTarget: 'right_calf' },
  { key: 'hair', label: 'Cabello', category: 'extra', connectionTarget: 'head' },
  { key: 'helmet', label: 'Casco', category: 'extra', connectionTarget: 'head' },
  { key: 'glasses', label: 'Gafas', category: 'extra', connectionTarget: 'head' },
  { key: 'upper_clothing', label: 'Ropa superior', category: 'extra', connectionTarget: 'torso' },
  { key: 'lower_clothing', label: 'Ropa inferior', category: 'extra', connectionTarget: 'pelvis' },
  { key: 'shoulder_pads', label: 'Hombreras', category: 'extra', connectionTarget: 'torso' },
  { key: 'gloves', label: 'Guantes', category: 'extra', connectionTarget: 'left_hand' },
  { key: 'boots', label: 'Botas', category: 'extra', connectionTarget: 'left_foot' },
  { key: 'accessories', label: 'Accesorios', category: 'extra', connectionTarget: 'torso' },
] as const

export const AUTO_FRAGMENT_KEYWORDS: Record<string, string[]> = {
  head: ['head', 'cabeza', 'face'],
  neck: ['neck', 'cuello'],
  torso: ['torso', 'chest', 'body', 'spine'],
  left_arm: ['leftarm', 'l_arm', 'upperarm_l', 'brazo_izq', 'arm_l'],
  right_arm: ['rightarm', 'r_arm', 'upperarm_r', 'brazo_der', 'arm_r'],
  left_forearm: ['forearm_l', 'leftforearm', 'antebrazo_izq', 'lowerarm_l'],
  right_forearm: ['forearm_r', 'rightforearm', 'antebrazo_der', 'lowerarm_r'],
  left_hand: ['hand_l', 'lefthand', 'mano_izq'],
  right_hand: ['hand_r', 'righthand', 'mano_der'],
  pelvis: ['pelvis', 'hips', 'cadera'],
  left_leg: ['upleg_l', 'leftleg', 'pierna_izq', 'thigh_l'],
  right_leg: ['upleg_r', 'rightleg', 'pierna_der', 'thigh_r'],
  left_calf: ['calf_l', 'leftcalf', 'pantorrilla_izq', 'shin_l'],
  right_calf: ['calf_r', 'rightcalf', 'pantorrilla_der', 'shin_r'],
  left_foot: ['foot_l', 'leftfoot', 'pie_izq'],
  right_foot: ['foot_r', 'rightfoot', 'pie_der'],
  hair: ['hair', 'cabello', 'pelo'],
  helmet: ['helmet', 'casco'],
  glasses: ['glasses', 'gafas'],
  upper_clothing: ['shirt', 'top', 'upper', 'ropa_superior', 'jacket'],
  lower_clothing: ['pants', 'bottom', 'lower', 'ropa_inferior', 'skirt'],
  shoulder_pads: ['shoulder', 'hombrera'],
  gloves: ['glove', 'guante'],
  boots: ['boot', 'bota'],
  accessories: ['accessory', 'prop', 'bag', 'belt', 'accesorio'],
}

export const MODULAR_LAB_STORAGE_ROOT = 'storage/modular-characters'

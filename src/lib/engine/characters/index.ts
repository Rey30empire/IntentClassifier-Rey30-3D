/**
 * NEXUS Engine - Characters Module
 * 
 * Sistema de biblioteca de personajes
 */

export {
  CharacterLibraryManager,
  createCharacterLibrary,
  
  // Types
  type CharacterType,
  type CharacterCategory,
  type CharacterStyle,
  type CharacterGender,
  
  // Body
  type BodyProportions,
  type HeadParameters,
  type HairParameters,
  type FacialHairParameters,
  
  // Clothing
  type ClothingCategory,
  type ClothingItem,
  type Accessory,
  type Outfit,
  
  // Animation
  type CharacterPose,
  type CharacterAnimation,
  type AnimationKeyframe,
  
  // Instance
  type CharacterInstance,
  type CharacterOverrides,
  type CharacterDefinition,
  
  // Library
  type LibraryEntry,
  type CharacterFilters,
  type CharacterSortField,
  type CharacterSortOrder,
  type CharacterSortOptions,
} from './CharacterLibrary';

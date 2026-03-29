/**
 * Asset System - Main Export
 */

export {
  AssetManager,
  createAssetManager,
  getAssetManager,
  type Asset,
  type AssetType,
  type AssetStatus,
  type AssetMetadata,
  type AssetLoadOptions,
  type LoadingProgress,
} from './AssetManager';

export const AssetEvents = {
  ASSET_LOADING_STARTED: 'asset:loading_started',
  ASSET_LOADED: 'asset:loaded',
  ASSET_ERROR: 'asset:error',
  ASSET_PROGRESS: 'asset:progress',
  ASSET_DISPOSED: 'asset:disposed',
  ASSETS_BATCH_LOADED: 'assets:batch_loaded',
  ASSETS_DISPOSED_ALL: 'assets:disposed_all',
} as const;

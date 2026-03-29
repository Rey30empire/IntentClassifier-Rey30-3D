-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PresetVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

-- CreateEnum
CREATE TYPE "SceneProjectStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AssetImportSourceType" AS ENUM ('MANUAL_UPLOAD', 'LIBRARY_SYNC', 'CONVERSION_PIPELINE');

-- CreateEnum
CREATE TYPE "CharacterWorkflowStatus" AS ENUM ('UPLOADED', 'ANALYZED', 'FRAGMENTED', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'SESSION', 'CHARACTER', 'CHARACTER_PRESET', 'CHARACTER_PART', 'SCENE_PROJECT', 'ASSET_IMPORT', 'ASSET_FAVORITE', 'UPLOAD', 'EXPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'FAVORITED', 'UNFAVORITED', 'IMPORT_REQUESTED', 'IMPORT_COMPLETED', 'IMPORT_FAILED', 'LOGIN', 'LOGOUT', 'SYSTEM_EVENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseBodyId" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "colors" JSONB NOT NULL,
    "tags" JSONB,
    "metadata" JSONB,
    "thumbnailUrl" TEXT,
    "visibility" "PresetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceMimeType" TEXT,
    "sourceFilePath" TEXT NOT NULL,
    "storageRoot" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "previewImagePath" TEXT,
    "workflowStatus" "CharacterWorkflowStatus" NOT NULL DEFAULT 'UPLOADED',
    "meshCount" INTEGER NOT NULL DEFAULT 0,
    "materialCount" INTEGER NOT NULL DEFAULT 0,
    "hasRig" BOOLEAN NOT NULL DEFAULT false,
    "hasAnimations" BOOLEAN NOT NULL DEFAULT false,
    "analysis" JSONB,
    "fragmentationSchema" JSONB,
    "connectionSchema" JSONB,
    "unityMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterPart" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assignmentMode" TEXT NOT NULL,
    "sourceMeshNames" JSONB NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "materials" JSONB,
    "textures" JSONB,
    "hasRig" BOOLEAN NOT NULL DEFAULT false,
    "usedBones" JSONB,
    "pivot" JSONB,
    "scale" JSONB,
    "boundingBox" JSONB,
    "connectionPoints" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "characterId" TEXT,
    "originalName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "assetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SceneProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "engineVersion" TEXT,
    "sceneData" JSONB NOT NULL,
    "previewImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetImportJob" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "sourceType" "AssetImportSourceType" NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "status" "AssetImportStatus" NOT NULL DEFAULT 'PENDING',
    "assetId" TEXT,
    "category" TEXT,
    "sourcePath" TEXT,
    "registryPath" TEXT,
    "runtimeEntry" TEXT,
    "metadata" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AssetImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT,
    "characterId" TEXT NOT NULL,
    "exportMode" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "includedParts" JSONB,
    "storagePath" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "CharacterPreset_userId_idx" ON "CharacterPreset"("userId");

-- CreateIndex
CREATE INDEX "CharacterPreset_sessionKey_idx" ON "CharacterPreset"("sessionKey");

-- CreateIndex
CREATE INDEX "CharacterPreset_visibility_idx" ON "CharacterPreset"("visibility");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_sessionKey_idx" ON "Character"("sessionKey");

-- CreateIndex
CREATE INDEX "Character_workflowStatus_idx" ON "Character"("workflowStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Character_sessionKey_slug_key" ON "Character"("sessionKey", "slug");

-- CreateIndex
CREATE INDEX "CharacterPart_characterId_idx" ON "CharacterPart"("characterId");

-- CreateIndex
CREATE INDEX "CharacterPart_category_idx" ON "CharacterPart"("category");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterPart_characterId_partKey_key" ON "CharacterPart"("characterId", "partKey");

-- CreateIndex
CREATE INDEX "Upload_userId_idx" ON "Upload"("userId");

-- CreateIndex
CREATE INDEX "Upload_sessionKey_idx" ON "Upload"("sessionKey");

-- CreateIndex
CREATE INDEX "Upload_characterId_idx" ON "Upload"("characterId");

-- CreateIndex
CREATE INDEX "AssetFavorite_userId_idx" ON "AssetFavorite"("userId");

-- CreateIndex
CREATE INDEX "AssetFavorite_sessionKey_idx" ON "AssetFavorite"("sessionKey");

-- CreateIndex
CREATE INDEX "AssetFavorite_category_idx" ON "AssetFavorite"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFavorite_userId_assetId_key" ON "AssetFavorite"("userId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFavorite_sessionKey_assetId_key" ON "AssetFavorite"("sessionKey", "assetId");

-- CreateIndex
CREATE INDEX "SceneProject_userId_idx" ON "SceneProject"("userId");

-- CreateIndex
CREATE INDEX "SceneProject_sessionKey_idx" ON "SceneProject"("sessionKey");

-- CreateIndex
CREATE INDEX "SceneProject_status_idx" ON "SceneProject"("status");

-- CreateIndex
CREATE INDEX "AssetImportJob_requestedByUserId_idx" ON "AssetImportJob"("requestedByUserId");

-- CreateIndex
CREATE INDEX "AssetImportJob_status_idx" ON "AssetImportJob"("status");

-- CreateIndex
CREATE INDEX "AssetImportJob_category_idx" ON "AssetImportJob"("category");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CharacterExport_userId_idx" ON "CharacterExport"("userId");

-- CreateIndex
CREATE INDEX "CharacterExport_sessionKey_idx" ON "CharacterExport"("sessionKey");

-- CreateIndex
CREATE INDEX "CharacterExport_characterId_idx" ON "CharacterExport"("characterId");

-- CreateIndex
CREATE INDEX "CharacterExport_exportMode_idx" ON "CharacterExport"("exportMode");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPreset" ADD CONSTRAINT "CharacterPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPart" ADD CONSTRAINT "CharacterPart_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFavorite" ADD CONSTRAINT "AssetFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneProject" ADD CONSTRAINT "SceneProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetImportJob" ADD CONSTRAINT "AssetImportJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterExport" ADD CONSTRAINT "CharacterExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterExport" ADD CONSTRAINT "CharacterExport_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SegType" AS ENUM ('SPEECH', 'MUSIC');

-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserTeamRole" AS ENUM ('ADMIN', 'WRITE', 'READ');

-- CreateTable
CREATE TABLE "Recording" (
    "uuid" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "teamUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL,
    "fileCreateDate" TIMESTAMP(3) NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "referenceUuid" TEXT,
    "targetPipelineVersion" TEXT NOT NULL,
    "processedPipelineVersion" TEXT,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "uuid" TEXT NOT NULL,
    "recordingUuid" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "pipelineVersion" TEXT NOT NULL,
    "stage" TEXT,
    "stageRuns" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" INTEGER NOT NULL,
    "recordingUuid" TEXT NOT NULL,
    "type" "SegType" NOT NULL,
    "start" DOUBLE PRECISION NOT NULL,
    "end" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "referenceUuid" TEXT,
    "refStart" DOUBLE PRECISION,
    "refEnd" DOUBLE PRECISION,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id","recordingUuid")
);

-- CreateTable
CREATE TABLE "Reference" (
    "uuid" TEXT NOT NULL,
    "teamUuid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "status" "ReferenceStatus" NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Team" (
    "uuid" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "User" (
    "uuid" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "UserTeam" (
    "teamUuid" TEXT NOT NULL,
    "userUuid" TEXT NOT NULL,
    "role" "UserTeamRole" NOT NULL,

    CONSTRAINT "UserTeam_pkey" PRIMARY KEY ("teamUuid","userUuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_id_teamUuid_key" ON "Recording"("id", "teamUuid");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_recordingUuid_key" ON "ProcessingJob"("recordingUuid");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_id_key" ON "Team"("id");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_teamUuid_fkey" FOREIGN KEY ("teamUuid") REFERENCES "Team"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_referenceUuid_fkey" FOREIGN KEY ("referenceUuid") REFERENCES "Reference"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_recordingUuid_fkey" FOREIGN KEY ("recordingUuid") REFERENCES "Recording"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_recordingUuid_fkey" FOREIGN KEY ("recordingUuid") REFERENCES "Recording"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_referenceUuid_fkey" FOREIGN KEY ("referenceUuid") REFERENCES "Reference"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_teamUuid_fkey" FOREIGN KEY ("teamUuid") REFERENCES "Team"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_teamUuid_fkey" FOREIGN KEY ("teamUuid") REFERENCES "Team"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTeam" ADD CONSTRAINT "UserTeam_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "User"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;


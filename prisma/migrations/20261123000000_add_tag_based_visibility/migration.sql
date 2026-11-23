-- CreateTable
CREATE TABLE "MemberTag" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionAudienceTag" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionAudienceTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberTag_tagId_idx" ON "MemberTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberTag_membershipId_tagId_key" ON "MemberTag"("membershipId", "tagId");

-- CreateIndex
CREATE INDEX "DecisionAudienceTag_tagId_idx" ON "DecisionAudienceTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionAudienceTag_decisionId_tagId_key" ON "DecisionAudienceTag"("decisionId", "tagId");

-- AddForeignKey
ALTER TABLE "MemberTag" ADD CONSTRAINT "MemberTag_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "WorkspaceMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberTag" ADD CONSTRAINT "MemberTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAudienceTag" ADD CONSTRAINT "DecisionAudienceTag_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionAudienceTag" ADD CONSTRAINT "DecisionAudienceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

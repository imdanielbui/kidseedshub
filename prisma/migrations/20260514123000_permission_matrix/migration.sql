-- CreateTable
CREATE TABLE "PermissionMatrixEntry" (
    "permission" TEXT NOT NULL,
    "roles" "Role"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionMatrixEntry_pkey" PRIMARY KEY ("permission")
);

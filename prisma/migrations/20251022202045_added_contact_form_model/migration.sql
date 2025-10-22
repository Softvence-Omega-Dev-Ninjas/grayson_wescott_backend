-- CreateTable
CREATE TABLE "contact_forms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT,

    CONSTRAINT "contact_forms_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contact_forms" ADD CONSTRAINT "contact_forms_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

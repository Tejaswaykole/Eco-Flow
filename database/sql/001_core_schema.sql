-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BOMStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BOMComponentType" AS ENUM ('RAW_MATERIAL', 'SUB_ASSEMBLY', 'HARDWARE', 'ELECTRONIC', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "ECOStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('QUANTITY_CHANGE', 'MATERIAL_CHANGE', 'COST_CHANGE', 'COMPONENT_ADDITION', 'COMPONENT_REMOVAL', 'SPECIFICATION_CHANGE');

-- CreateEnum
CREATE TYPE "ChangeTarget" AS ENUM ('PRODUCT', 'BOM', 'COMPONENT');

-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('COST', 'MATERIAL', 'MANUFACTURING', 'QUALITY', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VersionReleaseStatus" AS ENUM ('SCHEDULED', 'RELEASED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ECO_SUBMITTED', 'ECO_APPROVED', 'ECO_REJECTED', 'APPROVAL_REQUESTED', 'SYSTEM_ALERT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "module" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "token_family" UUID NOT NULL,
    "is_consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumed_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "status" "ProductCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "part_number" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attachments" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL,
    "bom_number" VARCHAR(100) NOT NULL,
    "product_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "BOMStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_components" (
    "id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "part_number" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "component_type" "BOMComponentType" NOT NULL DEFAULT 'RAW_MATERIAL',
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_of_measure" VARCHAR(50) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bom_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecos" (
    "id" UUID NOT NULL,
    "eco_number" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "product_id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "active_revision_no" INTEGER NOT NULL DEFAULT 1,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "ECOStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_date" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "created_by" UUID NOT NULL,
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_revisions" (
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "status" "ECOStatus" NOT NULL DEFAULT 'DRAFT',
    "change_summary" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eco_revisions_pkey" PRIMARY KEY ("eco_id","revision_number")
);

-- CreateTable
CREATE TABLE "eco_changes" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "change_target" "ChangeTarget" NOT NULL DEFAULT 'COMPONENT',
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "impact_type" "ImpactType" NOT NULL DEFAULT 'MATERIAL',
    "justification" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_revision_snapshots" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_revision_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_comments" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eco_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eco_attachments" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eco_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comments" TEXT,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_versions" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_versions" (
    "id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "eco_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_releases" (
    "id" UUID NOT NULL,
    "eco_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_version_id" UUID NOT NULL,
    "bom_version_id" UUID NOT NULL,
    "release_status" "VersionReleaseStatus" NOT NULL DEFAULT 'RELEASED',
    "released_by" UUID NOT NULL,
    "released_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "actor_id" UUID NOT NULL,
    "resource_id" VARCHAR(100),
    "request_hash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "response_body" JSONB,
    "lease_expires" TIMESTAMPTZ(6) NOT NULL,
    "claim_token" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_audits" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email_attempt" VARCHAR(255) NOT NULL,
    "is_success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "link" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_is_revoked_idx" ON "sessions"("is_revoked");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_family_idx" ON "refresh_tokens"("token_family");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_code_key" ON "product_categories"("code");

-- CreateIndex
CREATE INDEX "product_categories_status_idx" ON "product_categories"("status");

-- CreateIndex
CREATE UNIQUE INDEX "products_part_number_key" ON "products"("part_number");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "product_attachments_product_id_idx" ON "product_attachments"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "boms_bom_number_key" ON "boms"("bom_number");

-- CreateIndex
CREATE INDEX "boms_product_id_idx" ON "boms"("product_id");

-- CreateIndex
CREATE INDEX "boms_status_idx" ON "boms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "boms_id_product_id_key" ON "boms"("id", "product_id");

-- CreateIndex
CREATE INDEX "bom_components_bom_id_idx" ON "bom_components"("bom_id");

-- CreateIndex
CREATE INDEX "bom_components_part_number_idx" ON "bom_components"("part_number");

-- CreateIndex
CREATE UNIQUE INDEX "ecos_eco_number_key" ON "ecos"("eco_number");

-- CreateIndex
CREATE INDEX "ecos_product_id_idx" ON "ecos"("product_id");

-- CreateIndex
CREATE INDEX "ecos_bom_id_idx" ON "ecos"("bom_id");

-- CreateIndex
CREATE INDEX "ecos_status_idx" ON "ecos"("status");

-- CreateIndex
CREATE INDEX "ecos_created_by_idx" ON "ecos"("created_by");

-- CreateIndex
CREATE INDEX "ecos_assigned_to_idx" ON "ecos"("assigned_to");

-- CreateIndex
CREATE INDEX "eco_revisions_created_by_idx" ON "eco_revisions"("created_by");

-- CreateIndex
CREATE INDEX "eco_revisions_status_idx" ON "eco_revisions"("status");

-- CreateIndex
CREATE INDEX "eco_changes_eco_id_revision_number_idx" ON "eco_changes"("eco_id", "revision_number");

-- CreateIndex
CREATE INDEX "eco_changes_eco_id_idx" ON "eco_changes"("eco_id");

-- CreateIndex
CREATE UNIQUE INDEX "eco_revision_snapshots_eco_id_revision_number_key" ON "eco_revision_snapshots"("eco_id", "revision_number");

-- CreateIndex
CREATE INDEX "eco_comments_eco_id_idx" ON "eco_comments"("eco_id");

-- CreateIndex
CREATE INDEX "eco_comments_user_id_idx" ON "eco_comments"("user_id");

-- CreateIndex
CREATE INDEX "eco_attachments_eco_id_idx" ON "eco_attachments"("eco_id");

-- CreateIndex
CREATE INDEX "approvals_eco_id_revision_number_idx" ON "approvals"("eco_id", "revision_number");

-- CreateIndex
CREATE INDEX "approvals_approver_id_idx" ON "approvals"("approver_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_eco_id_revision_number_key" ON "approvals"("eco_id", "revision_number");

-- CreateIndex
CREATE INDEX "product_versions_product_id_idx" ON "product_versions"("product_id");

-- CreateIndex
CREATE INDEX "product_versions_eco_id_revision_number_idx" ON "product_versions"("eco_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "product_versions_id_product_id_key" ON "product_versions"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_versions_product_id_version_number_key" ON "product_versions"("product_id", "version_number");

-- CreateIndex
CREATE INDEX "bom_versions_bom_id_idx" ON "bom_versions"("bom_id");

-- CreateIndex
CREATE INDEX "bom_versions_product_id_idx" ON "bom_versions"("product_id");

-- CreateIndex
CREATE INDEX "bom_versions_eco_id_revision_number_idx" ON "bom_versions"("eco_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "bom_versions_id_product_id_key" ON "bom_versions"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_versions_bom_id_version_number_key" ON "bom_versions"("bom_id", "version_number");

-- CreateIndex
CREATE INDEX "version_releases_product_id_idx" ON "version_releases"("product_id");

-- CreateIndex
CREATE INDEX "version_releases_product_version_id_idx" ON "version_releases"("product_version_id");

-- CreateIndex
CREATE INDEX "version_releases_bom_version_id_idx" ON "version_releases"("bom_version_id");

-- CreateIndex
CREATE INDEX "version_releases_released_by_idx" ON "version_releases"("released_by");

-- CreateIndex
CREATE UNIQUE INDEX "version_releases_eco_id_key" ON "version_releases"("eco_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_actor_id_idx" ON "idempotency_keys"("actor_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_scope_resource_id_idx" ON "idempotency_keys"("scope", "resource_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_lease_expires_idx" ON "idempotency_keys"("lease_expires");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "login_audits_user_id_idx" ON "login_audits"("user_id");

-- CreateIndex
CREATE INDEX "login_audits_email_attempt_idx" ON "login_audits"("email_attempt");

-- CreateIndex
CREATE INDEX "login_audits_created_at_idx" ON "login_audits"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attachments" ADD CONSTRAINT "product_attachments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attachments" ADD CONSTRAINT "product_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecos" ADD CONSTRAINT "ecos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecos" ADD CONSTRAINT "ecos_bom_id_product_id_fkey" FOREIGN KEY ("bom_id", "product_id") REFERENCES "boms"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecos" ADD CONSTRAINT "ecos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecos" ADD CONSTRAINT "ecos_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_revisions" ADD CONSTRAINT "eco_revisions_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_revisions" ADD CONSTRAINT "eco_revisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_changes" ADD CONSTRAINT "eco_changes_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_changes" ADD CONSTRAINT "eco_changes_eco_id_revision_number_fkey" FOREIGN KEY ("eco_id", "revision_number") REFERENCES "eco_revisions"("eco_id", "revision_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_revision_snapshots" ADD CONSTRAINT "eco_revision_snapshots_eco_id_revision_number_fkey" FOREIGN KEY ("eco_id", "revision_number") REFERENCES "eco_revisions"("eco_id", "revision_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_comments" ADD CONSTRAINT "eco_comments_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_comments" ADD CONSTRAINT "eco_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_attachments" ADD CONSTRAINT "eco_attachments_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eco_attachments" ADD CONSTRAINT "eco_attachments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_eco_id_revision_number_fkey" FOREIGN KEY ("eco_id", "revision_number") REFERENCES "eco_revisions"("eco_id", "revision_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_eco_id_revision_number_fkey" FOREIGN KEY ("eco_id", "revision_number") REFERENCES "eco_revisions"("eco_id", "revision_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_bom_id_product_id_fkey" FOREIGN KEY ("bom_id", "product_id") REFERENCES "boms"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_eco_id_revision_number_fkey" FOREIGN KEY ("eco_id", "revision_number") REFERENCES "eco_revisions"("eco_id", "revision_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_releases" ADD CONSTRAINT "version_releases_eco_id_fkey" FOREIGN KEY ("eco_id") REFERENCES "ecos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_releases" ADD CONSTRAINT "version_releases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_releases" ADD CONSTRAINT "version_releases_product_version_id_product_id_fkey" FOREIGN KEY ("product_version_id", "product_id") REFERENCES "product_versions"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_releases" ADD CONSTRAINT "version_releases_bom_version_id_product_id_fkey" FOREIGN KEY ("bom_version_id", "product_id") REFERENCES "bom_versions"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_releases" ADD CONSTRAINT "version_releases_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_audits" ADD CONSTRAINT "login_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


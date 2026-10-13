-- CreateEnum
CREATE TYPE "plan_scope" AS ENUM ('ACCOUNT', 'USER');

-- CreateEnum
CREATE TYPE "outcome" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "rule_level" AS ENUM ('ACCOUNT', 'USER');

-- CreateEnum
CREATE TYPE "rule_type" AS ENUM ('MAX_PER_REQUEST', 'MONTHLY_ALLOWANCE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "account_plan_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "user_plan_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "scope" "plan_scope" NOT NULL,
    "owner_account_id" UUID,
    "is_predefined" BOOLEAN NOT NULL DEFAULT false,
    "monthly_allowance" INTEGER NOT NULL,
    "max_per_request" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_monthly_usage" (
    "account_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_monthly_usage_pkey" PRIMARY KEY ("account_id","month")
);

-- CreateTable
CREATE TABLE "user_monthly_usage" (
    "user_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "account_id" UUID NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("user_id","month")
);

-- CreateTable
CREATE TABLE "consumption_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_id" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "payload_fingerprint" TEXT NOT NULL,
    "outcome" "outcome",
    "rejected_rule" "rule_type",
    "rejected_level" "rule_level",
    "violations" JSONB NOT NULL DEFAULT '[]',
    "limits_snapshot" JSONB,
    "month" DATE NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumption_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_account_id_idx" ON "api_keys"("account_id");

-- CreateIndex
CREATE INDEX "users_user_plan_id_idx" ON "users"("user_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_account_id_external_user_id_key" ON "users"("account_id", "external_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_account_id_key" ON "users"("id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_owner_account_id_scope_name_key" ON "plans"("owner_account_id", "scope", "name");

-- CreateIndex
CREATE INDEX "user_monthly_usage_account_id_month_idx" ON "user_monthly_usage"("account_id", "month");

-- CreateIndex
CREATE INDEX "consumption_requests_account_id_processed_at_id_idx" ON "consumption_requests"("account_id", "processed_at" DESC, "id");

-- CreateIndex
CREATE INDEX "consumption_requests_user_id_processed_at_id_idx" ON "consumption_requests"("user_id", "processed_at" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "consumption_requests_account_id_request_id_key" ON "consumption_requests"("account_id", "request_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_plan_id_fkey" FOREIGN KEY ("account_plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_user_plan_id_fkey" FOREIGN KEY ("user_plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_account_id_fkey" FOREIGN KEY ("owner_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_monthly_usage" ADD CONSTRAINT "account_monthly_usage_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_user_id_account_id_fkey" FOREIGN KEY ("user_id", "account_id") REFERENCES "users"("id", "account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_requests" ADD CONSTRAINT "consumption_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_requests" ADD CONSTRAINT "consumption_requests_user_id_account_id_fkey" FOREIGN KEY ("user_id", "account_id") REFERENCES "users"("id", "account_id") ON DELETE CASCADE ON UPDATE CASCADE;

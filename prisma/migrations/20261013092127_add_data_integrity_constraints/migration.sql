ALTER TABLE "plans"
ADD CONSTRAINT "plans_monthly_allowance_positive_check" 
CHECK ("monthly_allowance" >= 0);

ALTER TABLE "plans"
ADD CONSTRAINT "plans_max_per_request_positive_check"
CHECK ("max_per_request" >= 0);

ALTER TABLE "plans"
ADD CONSTRAINT "plans_predefined_owner_consistency_check"
CHECK (
    ("is_predefined" = TRUE and "owner_account_id" IS NULL) or
    ("is_predefined" = FALSE and "owner_account_id" IS NOT NULL)
);

-- Prevent duplicate predefined plan names within the same scope
CREATE UNIQUE INDEX "plans_predefined_scope_name_key"
ON "plans" ("scope", "name")
WHERE "owner_account_id" IS NULL;

ALTER TABLE "account_monthly_usage"
ADD CONSTRAINT "account_monthly_usage_usage_non_negative_check"
CHECK ("consumed" >= 0);

ALTER TABLE "user_monthly_usage"
ADD CONSTRAINT "user_monthly_usage_usage_non_negative_check"
CHECK ("consumed" >= 0);

ALTER TABLE "consumption_requests"
ADD CONSTRAINT "consumption_requests_units_positive_check"
CHECK ("units" > 0);

ALTER TABLE "consumption_requests"
ADD CONSTRAINT "consumption_requests_request_id_nonempty_check"
CHECK (length(trim("request_id")) > 0);

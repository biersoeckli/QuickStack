-- S3Target.endpoint stores the complete endpoint URL. Preserve explicit
-- schemes and make legacy host-only endpoints use HTTPS.
UPDATE "S3Target"
SET "endpoint" = 'https://' || "endpoint"
WHERE lower("endpoint") NOT LIKE 'http://%'
  AND lower("endpoint") NOT LIKE 'https://%';

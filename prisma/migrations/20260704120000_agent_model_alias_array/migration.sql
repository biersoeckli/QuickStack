-- Store Agent model aliases as a JSON array encoded in the existing TEXT column.
UPDATE "Agent"
SET "modelAlias" = CASE
  WHEN "modelAlias" IS NULL OR trim("modelAlias") = '' THEN '[]'
  WHEN json_valid("modelAlias") THEN
    CASE
      WHEN json_type("modelAlias") = 'array' THEN "modelAlias"
      ELSE json_array("modelAlias")
    END
  ELSE json_array("modelAlias")
END;

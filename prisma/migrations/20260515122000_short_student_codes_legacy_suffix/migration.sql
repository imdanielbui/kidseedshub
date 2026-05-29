-- Convert legacy test/student codes such as KSH-2026-SM0065 to KS26-065.
UPDATE "Student"
SET "code" = 'KS' || RIGHT(SPLIT_PART("code", '-', 2), 2) || '-' || LPAD((SUBSTRING(SPLIT_PART("code", '-', 3) FROM '[0-9]+$')::INTEGER)::TEXT, 3, '0')
WHERE "code" ~ '^KSH-[0-9]{4}-[A-Z]+[0-9]+$';

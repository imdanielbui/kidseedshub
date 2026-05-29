-- Convert student codes from KSH-YYYY-0001 to KSYY-001.
UPDATE "Student"
SET "code" = 'KS' || RIGHT(SPLIT_PART("code", '-', 2), 2) || '-' || LPAD((SPLIT_PART("code", '-', 3)::INTEGER)::TEXT, 3, '0')
WHERE "code" ~ '^KSH-[0-9]{4}-[0-9]{4}$';

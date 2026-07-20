-- Rename the legacy 'TELEGRAM' theme value to 'AURORA' and add a new 'ROSE' theme.
-- Renaming preserves existing rows (their stored value is updated in place) and
-- automatically updates the column default that referenced it.
ALTER TYPE "Theme" RENAME VALUE 'TELEGRAM' TO 'AURORA';

-- AlterEnum
ALTER TYPE "Theme" ADD VALUE 'ROSE';

// Destructive-statement rules for rollback capsules.
//
// Extracted from verify-sql-boundary.mjs so the rules can be exercised directly
// by tests. The gate they serve is load-bearing: it is the step whose failure
// caused twelve later verification steps to report conclusion=skipped (F-013),
// so its behaviour needs to be pinned rather than inferred from a green run.

// The destructive-statement scan matches raw text, so a rollback was rejected
// for the word TRUNCATE inside a has_table_privilege() argument, and an earlier
// one for naming the banned statements in its own explanatory comment. Remove
// only the places SQL cannot execute a statement -- comments and single-quoted
// literals -- before scanning. Dollar-quoted blocks are deliberately left
// intact: function bodies can contain genuinely destructive statements.
export function stripNonExecutableSql(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

// ALTER PUBLICATION ... DROP TABLE removes a table from logical replication;
// it does not drop the table or delete rows. Strip only that complete statement
// before applying the destructive table/data rollback scan.
export function stripPublicationMembershipChanges(content) {
  return content.replace(
    /\balter\s+publication\s+(?:"[^"]+"|[a-z_][\w$]*)\s+drop\s+table\s+(?:only\s+)?(?:"[^"]+"|[a-z_][\w$]*)(?:\.(?:"[^"]+"|[a-z_][\w$]*))?\s*;/gi,
    ' ',
  );
}

const QUALIFIED_NAME = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|[A-Za-z_][\w$]*))?`;

const CREATE_TABLE = new RegExp(
  String.raw`\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED_NAME})`,
  'gi',
);

// Deliberately single-target: `drop table a, b;` does not match and therefore
// never earns the exemption. Parsing a table list correctly is not worth the
// risk of getting it subtly wrong in a gate that guards production data.
const DROP_TABLE = new RegExp(
  String.raw`\bdrop\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${QUALIFIED_NAME})\s*(?:cascade|restrict)?\s*;`,
  'gi',
);

// PostgreSQL folds unquoted identifiers to lower case and preserves quoted ones,
// so "MixedCase" and mixedcase are different tables. Collapsing them here would
// let a rollback drop one on the strength of a migration that created the other.
function normalizeQualifiedName(raw) {
  return raw
    .split('.')
    .map((part) => (part.startsWith('"') ? part.slice(1, -1) : part.toLowerCase()))
    .join('.');
}

/** Qualified names of tables a migration creates, ignoring commented-out SQL. */
export function createdTablesIn(migrationSql) {
  const created = new Set();
  if (!migrationSql) return created;
  for (const match of stripNonExecutableSql(migrationSql).matchAll(CREATE_TABLE)) {
    created.add(normalizeQualifiedName(match[1]));
  }
  return created;
}

// A rollback that removes a table its own paired migration created is the
// correct reversal of that migration, not data loss: before the migration ran,
// the table did not exist. Rewriting such a rollback to be "non-destructive"
// would leave an orphan table behind and make the capsule wrong.
//
// The exemption is scoped to exactly those tables. Dropping anything else, and
// TRUNCATE or DELETE FROM in any form, remains a failure.
export function stripPairedCreateTableDrops(content, createdTables) {
  if (!createdTables?.size) return content;
  return content.replace(DROP_TABLE, (statement, name) =>
    createdTables.has(normalizeQualifiedName(name)) ? ' ' : statement,
  );
}

/**
 * True when a rollback capsule contains a destructive statement that its paired
 * migration does not justify.
 *
 * @param {string} rollbackSql   contents of the *.rollback.sql capsule
 * @param {string|null} migrationSql contents of the paired migration, or null
 *   when there is no pair -- in which case no exemption is granted.
 */
export function hasDestructiveRollbackStatements(rollbackSql, migrationSql) {
  const executable = stripPairedCreateTableDrops(
    stripPublicationMembershipChanges(stripNonExecutableSql(rollbackSql)),
    createdTablesIn(migrationSql),
  );
  return /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(executable);
}

// Consistent "TC-<id>: <title>" display everywhere a test case's title is
// shown to a user — a test case is usually referenced by its number
// elsewhere (generated spec titles, PRs, bug reports), so the title alone
// leaves the reader with no way to cross-reference it. Deliberately takes
// id and title as separate explicit arguments rather than a whole object:
// different pages join test cases through different tables (a suite
// roster row's own `id` is NOT the same as its linked test case's
// `test_case_id`, an execution-run row's id is a junction-table id, etc.),
// so guessing which field is "the" id from the object shape risks quietly
// showing the wrong number — worse than showing none. Callers must resolve
// the real test case id themselves. Falls back to the bare title if there
// is no linked test case id at all (e.g. an unlinked/manual-origin roster
// row) rather than showing a broken "TC-undefined".
export function tcLabel(id, title) {
  return id ? `TC-${id}: ${title}` : (title || '')
}

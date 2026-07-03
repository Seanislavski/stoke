// Question of the Week is derived from a specially-named Q&A category rather than a
// dedicated column — so it needs no migration and each community controls it by
// filing (or approving) a question into its "Question of the Week" category.
// The current spotlight is simply the newest published question in that category;
// past weeks accumulate there as an answerable archive.

export const QOTW_CATEGORY_NAME = 'Question of the Week'

type NamedCategory = { id: string; name: string }

/** Returns the id of a community's "Question of the Week" category, or null if it has none. */
export function findQotwCategoryId(categories: NamedCategory[]): string | null {
  const match = categories.find(
    c => c.name.trim().toLowerCase() === QOTW_CATEGORY_NAME.toLowerCase()
  )
  return match?.id ?? null
}

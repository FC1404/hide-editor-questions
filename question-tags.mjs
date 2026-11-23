export const questionTagsWidget = 'question-tags-editor';
export const questionTagsStorageKey = 'question-tag-list';

export function normalizeQuestionTags(tags) {
  return [...new Set(tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean))];
}

export async function readQuestionTags(plugin) {
  const stored = await plugin.storage.getSynced(questionTagsStorageKey);
  return Array.isArray(stored) ? normalizeQuestionTags(stored) : [];
}


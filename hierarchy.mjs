import { RemType } from '@remnote/plugin-sdk';
import { readQuestionTags } from './question-tags.mjs';

const editor = '.rn-editor';
const editorOnly = ':not(.rn-queue *, .rn-queue-container *, .rn-flashcards-edit *)';
const row = `.container-node${editorOnly}`;

function nodeAttributes(ids, attribute, includePortalSuffix = false) {
  return [...ids]
    .filter(id => /^[\w-]+$/.test(id))
    .sort()
    .flatMap(id => includePortalSuffix
      ? [`[${attribute}="${id}"]`, `[${attribute}^="${id}-"]`]
      : [`[${attribute}="${id}"]`])
    .join(',');
}

function rowSelector(ids) {
  const attributes = nodeAttributes(ids, 'data-rem-container-id');
  return attributes ? `${editor} ${row}:is(${attributes})` : '';
}

function cardTextCSS(ids, backward, scopeSupported) {
  const rows = rowSelector(ids);
  if (!rows) return '';
  const delimiterClasses = '.rn-card-delimiter, .separator-symbol';
  const delimiter = `:is(${delimiterClasses})`;
  const editorItem = '[data-linear-editor-text]';
  const editorDelimiter = `${editorItem}:has(${delimiter})`;
  // The fast renderer and the read-only editor emit a sibling for the arrow.
  // The editable row wraps the arrow inside a linear editor item.
  const readOnly = backward ? `${delimiterClasses}, ${delimiter} ~ *` : `${delimiterClasses}, :has(~ ${delimiter})`;
  const editable = backward
    ? `${editorDelimiter}, ${editorDelimiter} ~ ${editorItem}`
    : `${editorDelimiter}, ${editorItem}:has(~ ${editorItem} ${delimiter})`;
  // The Rem IDs already identify tagged cards, including tags with spaces
  // and punctuation. data-rem-id bounds the rules to that card's body.
  const root = `${rows} :is(.rn-editor__rem__body, .rn-fast-rem-container)`;
  const boundary = '.container-node, [data-rem-id], .rn-editor, .rn-queue, .rn-flashcards-edit';
  const readOnlyText = `.rn-editor__rem__body__text :is([id^="fast-rem-"], .EditorContainer) > :is(${readOnly})`;
  const editableText = `.rn-editor__rem__body__text .EditorContainer > :is(${editable})`;
  if (!scopeSupported) {
    const nested = `${root} :is(${boundary})`;
    const withinCard = `:not(${nested}, ${nested} *)`;
    return `${root} ${readOnlyText}${withinCard},\n${root} ${editableText}${withinCard} { display: none !important; }`;
  }
  return `@scope (${root}) to (${boundary}) {
    ${readOnlyText},
    ${editableText} {
      display: none !important;
    }
}`;
}

function guideSelector(ids) {
  const attributes = nodeAttributes(ids, 'data-children-node-id', true);
  return attributes ? `${editor} .flattened-children-node${editorOnly}:is(${attributes})` : '';
}

function tableSelectors(ids) {
  const rootIds = nodeAttributes(ids, 'data-container-node-id', true);
  if (!rootIds) return [];
  // The table header, body and cells are positioned separately by the editor.
  // Rows and cell lists share the table portal's context even when their Rem
  // belongs to another document (for example in a table built from a tag).
  const portalNodes = nodeAttributes(ids, 'data-portal-id', true);
  const portalGuides = nodeAttributes(ids, 'data-children-div-portal-id');
  return [
    `${editor} ${row}.rn-editor-container:is(${rootIds})`,
    `${editor} ${row}:is(${portalNodes})`,
    `${editor} .flattened-children-node${editorOnly}:is(${portalGuides})`,
    guideSelector(ids),
  ];
}

async function getAnswerSubtreeLayout(answers) {
  const descendants = (await Promise.all(answers.map(answer => answer.getDescendants()))).flat();
  const rems = new Map([...answers, ...descendants].map(rem => [rem._id, rem]));
  const childrenByParent = new Map();
  for (const rem of rems.values()) {
    const children = childrenByParent.get(rem.parent) ?? [];
    children.push(rem._id);
    childrenByParent.set(rem.parent, children);
  }

  // Table cells can be rendered outside the table's DOM subtree. Use the
  // Rem hierarchy so those rows keep the layout calculated for their cells.
  const portals = [...rems.values()].filter(rem => rem.type === RemType.PORTAL);
  const tableFlags = await Promise.all(portals.map(portal => portal.isTable()));
  const tableIds = new Set(portals.filter((_, index) => tableFlags[index]).map(portal => portal._id));
  const pending = [...tableIds].flatMap(id => childrenByParent.get(id) ?? []);
  const tableInternals = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (tableInternals.has(id)) continue;
    tableInternals.add(id);
    for (const child of childrenByParent.get(id) ?? []) pending.push(child);
  }

  return { movableIds: [...rems.keys()].filter(id => !tableInternals.has(id)), tableIds };
}

async function findTag(plugin, name) {
  const direct = await plugin.rem.findByName([name], null);
  if (direct) return direct;

  const path = name.split(/\s+>\s+/);
  let parent;
  if (path.length === 1) return;
  for (const part of path) {
    parent = await plugin.rem.findByName([part], parent?._id ?? null);
    if (!parent) return;
  }
  return parent;
}

export async function readCardLayout(plugin) {
  const tagNames = await readQuestionTags(plugin);
  const tags = await Promise.all(tagNames.map(name => findTag(plugin, name)));
  const uniqueTags = new Map(tags.filter(Boolean).map(tag => [tag._id, tag]));
  const questions = (await Promise.all([...uniqueTags.values()].map(tag => tag.taggedRem()))).flat();
  const uniqueQuestions = new Map(questions.map(question => [question._id, question]));

  const cards = await Promise.all([...uniqueQuestions.values()].map(async question => {
    const [children, direction] = await Promise.all([question.getChildrenRem(), question.getPracticeDirection()]);
    const cardItemFlags = await Promise.all(children.map(child => child.isCardItem()));
    return { question, direction, items: children.filter((_, index) => cardItemFlags[index]) };
  }));

  const forwardCards = new Set();
  const backwardCards = new Set();
  const forwardQuestions = new Map();
  const hiddenQuestions = new Set();
  const answerIds = new Set();
  const tables = new Set();
  const hiddenTables = new Set();
  const outdentById = new Map();

  await Promise.all(cards.map(async ({ question, direction, items }) => {
    if (direction === 'backward') {
      backwardCards.add(question._id);
      // For a multiline backward card, the parent is the answer and each
      // card item beneath it is a question. Normal sibling notes stay visible.
      for (const item of items) hiddenQuestions.add(item._id);
      const portals = items.filter(item => item.type === RemType.PORTAL);
      const tableFlags = await Promise.all(portals.map(portal => portal.isTable()));
      portals.forEach((portal, index) => {
        if (tableFlags[index]) hiddenTables.add(portal._id);
      });
      return;
    }

    forwardCards.add(question._id);
    if (!items.length) return;
    forwardQuestions.set(question._id, question);
    const { movableIds, tableIds } = await getAnswerSubtreeLayout(items);
    hiddenQuestions.add(question._id);
    for (const item of items) answerIds.add(item._id);
    // Every row in an answer's subtree shifts by the same amount. A nested
    // hidden question can shift its own answers one additional level.
    for (const id of movableIds) {
      if (tableIds.has(id)) tables.add(id);
      outdentById.set(id, (outdentById.get(id) ?? 0) + 1);
    }
  }));
  return { forwardCards, backwardCards, forwardQuestions, hiddenQuestions, answerIds, outdentById, tables, hiddenTables };
}

export function buildHierarchyCSS({ forwardCards, backwardCards, forwardQuestions, hiddenQuestions, answerIds, outdentById, tables, hiddenTables }, { scopeSupported = true } = {}) {
  const forwardRows = rowSelector(forwardQuestions.keys());
  const otherRows = rowSelector([...hiddenQuestions].filter(id => !forwardQuestions.has(id)));
  // Retain the expand control if the host has not rendered the children yet.
  const questions = [forwardRows && `${forwardRows}:not(:has(.toggle-collapse-button .-rotate-90))`, otherRows].filter(Boolean);
  const answers = rowSelector(answerIds);
  const rules = [cardTextCSS(forwardCards, false, scopeSupported), cardTextCSS(backwardCards, true, scopeSupported)].filter(Boolean);
  if (questions.length) {
    rules.push(`${questions.join(', ')} { min-height: 0 !important; }`);
    rules.push(`${questions.map(selector => `${selector} > .tree-node--parent`).join(', ')} { display: none !important; }`);
    rules.push(`${questions.map(selector => `${selector}.node-card-item::before`).join(', ')} { content: none !important; }`);
    rules.push(`${guideSelector(hiddenQuestions)} { border-inline-start-color: transparent !important; }`);
  }
  const hiddenTableParts = tableSelectors(hiddenTables);
  if (hiddenTableParts.length) rules.push(`${hiddenTableParts.join(', ')} { display: none !important; }`);
  const tableAnswers = nodeAttributes([...answerIds].filter(id => tables.has(id)), 'data-container-node-id', true);
  const answerBrackets = [
    ...(answers ? [`${answers}.node-card-item::before`] : []),
    ...(tableAnswers ? [`${editor} ${row}.node-card-item:is(${tableAnswers})::before`] : []),
  ];
  if (answerBrackets.length) rules.push(`${answerBrackets.join(', ')} { content: none !important; }`);

  const idsByOffset = new Map();
  for (const [id, levels] of outdentById) {
    const ids = idsByOffset.get(levels) ?? [];
    ids.push(id);
    idsByOffset.set(levels, ids);
  }
  for (const [levels, ids] of [...idsByOffset].sort(([a], [b]) => a - b)) {
    const regularIds = ids.filter(id => !tables.has(id));
    const rows = rowSelector(regularIds);
    const offset = -24 * levels;
    // RemNote draws the multiline card guide on each item's container,
    // outside the row content that is moved by the outdent.
    const selectors = rows ? [
      `${rows} > .tree-node--parent`,
      `${rows}.node-card-item::before`,
      guideSelector(regularIds),
    ] : [];
    selectors.push(...tableSelectors(ids.filter(id => tables.has(id))));
    if (selectors.length) rules.push(`${selectors.join(', ')} { translate: ${offset}px 0; }`);
  }
  return rules.join('\n');
}

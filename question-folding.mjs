import { RemType } from '@remnote/plugin-sdk';

export async function readQuestionContexts(plugin, questions) {
  if (!questions.size) return new Map();
  const [openPaneIds, focusedPortal] = await Promise.all([
    plugin.window.getOpenPaneRemIds(),
    plugin.focus.getFocusedPortal(),
  ]);
  const openRoots = new Set(openPaneIds);
  if (!openRoots.size && focusedPortal) openRoots.add(focusedPortal._id);
  const contexts = new Map();
  const parents = new Map();

  function parentOf(rem) {
    if (!parents.has(rem._id)) parents.set(rem._id, rem.getParentRem());
    return parents.get(rem._id);
  }

  async function add(question, context) {
    const remId = question._id;
    const portalId = context._id;
    if (remId === portalId) return;
    const key = JSON.stringify([remId, context.type === RemType.PORTAL ? portalId : null]);
    const collapsed = await question.isCollapsed(portalId);
    if (!contexts.has(key)) contexts.set(key, { remId, portalId, collapsed });
  }

  await Promise.all([...questions.values()].map(async question => {
    let containingPortal;
    let inFocusedPortal = false;
    for (let parent = await parentOf(question); parent; parent = await parentOf(parent)) {
      if (openRoots.has(parent._id)) {
        const context = containingPortal ?? parent;
        await add(question, context);
        inFocusedPortal ||= context._id === focusedPortal?._id;
      }
      if (parent.type === RemType.PORTAL && !containingPortal) containingPortal = parent;
    }
    // A linked portal may render a question from outside the document tree.
    if (!inFocusedPortal && focusedPortal?.type === RemType.PORTAL &&
        (await question.portalsAndDocumentsIn() ?? []).some(portal => portal._id === focusedPortal._id)) {
      await add(question, focusedPortal);
    }
  }));
  return contexts;
}

export function createQuestionFolding(plugin) {
  const opened = new Map();

  return async function syncQuestionFolding(contexts = new Map()) {
    for (const [key, { remId, portalId }] of opened) {
      if (contexts.has(key)) continue;
      try {
        const rem = await plugin.rem.findOne(remId);
        if (rem && await rem.isCollapsed(portalId) === false) {
          await rem.setIsCollapsed(true, portalId);
          if (await rem.isCollapsed(portalId) === false) continue;
        }
        opened.delete(key);
      } catch (error) {
        console.error('Could not restore the original fold state.', error);
      }
    }
    for (const [key, { remId, portalId, collapsed }] of contexts) {
      if (!collapsed) continue;
      try {
        const rem = await plugin.rem.findOne(remId);
        if (rem && await rem.isCollapsed(portalId)) {
          await rem.setIsCollapsed(false, portalId);
          if (await rem.isCollapsed(portalId) === false) opened.set(key, { remId, portalId });
        }
      } catch (error) {
        console.error('Could not expand the flashcard answers.', error);
      }
    }
  };
}

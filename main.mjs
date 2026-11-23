import { AppEvents, PluginCommandMenuLocation, WidgetLocation, declareIndexPlugin, renderWidget } from '@remnote/plugin-sdk';
import { readCardLayout, buildHierarchyCSS } from './hierarchy.mjs';
import { createQuestionFolding, readQuestionContexts } from './question-folding.mjs';
import { answerViewState, answerViewWidget, toggleAnswerViewMessage } from './answer-view.mjs';
import { AnswerViewButton } from './answer-view-button.jsx';
import { questionTagsWidget } from './question-tags.mjs';
import { QuestionTagsEditor } from './question-tags-editor.jsx';

let stopTracker;
let onMessage;
let restoreOnDeactivate;

async function activate(plugin) {
  let enabled = (await plugin.storage.getSession(answerViewState)) !== false;
  let hierarchyCSS = '';
  let forwardQuestions = new Map();
  let questionContexts = new Map();
  let appliedCSS;
  let refreshNumber = 0;
  let writes = Promise.resolve();
  let toggles = Promise.resolve();
  let active = true;
  const syncQuestionFolding = createQuestionFolding(plugin);
  const openTags = () => plugin.widget.openPopup(questionTagsWidget, undefined, false);

  function updateView() {
    const next = writes.catch(() => {}).then(async () => {
      if (!active) return;
      if (enabled) await syncQuestionFolding(questionContexts);
      const css = enabled ? hierarchyCSS || '/* No tagged flashcards */' : '/* Answer view off */';
      if (css !== appliedCSS) {
        await plugin.app.registerCSS('hide-editor-questions', css);
        appliedCSS = css;
      }
      if (!enabled) await syncQuestionFolding();
    });
    writes = next;
    return next;
  }

  restoreOnDeactivate = async () => {
    active = false;
    await writes.catch(() => {});
    await syncQuestionFolding();
  };

  function toggleAnswerView(showToast) {
    toggles = toggles.catch(() => {}).then(async () => {
      if (!active) return;
      if (!enabled) questionContexts = await readQuestionContexts(plugin, forwardQuestions);
      enabled = !enabled;
      await updateView();
      await plugin.storage.setSession(answerViewState, enabled);
      if (showToast) await plugin.app.toast(enabled ? 'Answer view on' : 'Answer view off');
    });
    return toggles;
  }

  onMessage = event => {
    if (event?.message?.type !== toggleAnswerViewMessage) return;
    void toggleAnswerView(false).catch(error => {
      console.error('Could not toggle the answer view.', error);
    });
  };
  plugin.event.addListener(AppEvents.MessageBroadcast, undefined, onMessage);

  await plugin.app.registerCommand({
    id: toggleAnswerViewMessage,
    name: 'Flashcards: Toggle answer view',
    action: () => toggleAnswerView(true),
  });
  await plugin.app.registerWidget(questionTagsWidget, WidgetLocation.Popup, {
    dimensions: { width: 'min(880px, calc(100vw - 48px))', height: 'auto' },
  });
  await plugin.app.registerCommand({
    id: 'edit-question-tags',
    name: 'Flashcards: Edit tags for hiding questions',
    action: openTags,
  });
  await plugin.app.registerWidget(answerViewWidget, WidgetLocation.PaneHeader, {
    dimensions: { width: 60, height: 30 },
  });
  // The document menu is also reachable when RemNote uses its phone header.
  for (const menuItem of [
    { id: 'toggle-answer-view-menu', name: 'Flashcards: Toggle answer view', action: () => toggleAnswerView(true) },
    { id: 'edit-question-tags-menu', name: 'Flashcards: Edit tags for hiding questions', action: openTags },
  ]) {
    await plugin.app.registerMenuItem({ ...menuItem, location: PluginCommandMenuLocation.DocumentMenu }).catch(error => {
      console.error('Could not register the document menu item.', error);
    });
  }

  stopTracker = plugin.track(async reactivePlugin => {
    const refresh = ++refreshNumber;
    const layout = await readCardLayout(reactivePlugin);
    const contexts = await readQuestionContexts(reactivePlugin, layout.forwardQuestions);
    if (!active || refresh !== refreshNumber) return;
    forwardQuestions = layout.forwardQuestions;
    questionContexts = contexts;
    hierarchyCSS = buildHierarchyCSS(layout, { scopeSupported: typeof CSSScopeRule !== 'undefined' });
    await updateView();
  });
}

async function deactivate(plugin) {
  if (onMessage) plugin.event.removeListener(AppEvents.MessageBroadcast, undefined, onMessage);
  onMessage = undefined;
  stopTracker?.();
  stopTracker = undefined;
  const restore = restoreOnDeactivate;
  restoreOnDeactivate = undefined;
  await restore?.();
}

const widgetName = new URLSearchParams(window.location.search).get('widgetName');
if (widgetName === answerViewWidget) {
  renderWidget(AnswerViewButton);
} else if (widgetName === questionTagsWidget) {
  renderWidget(QuestionTagsEditor);
} else {
  declareIndexPlugin(activate, deactivate);
}

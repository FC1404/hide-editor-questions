import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlugin } from '@remnote/plugin-sdk';
import { normalizeQuestionTags, questionTagsStorageKey, readQuestionTags } from './question-tags.mjs';

const styles = `
  html { color-scheme: light dark; }
  body { margin: 0; background: transparent; }
  .tag-editor {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    padding: 24px;
    color: var(--rn-clr-content-primary, CanvasText);
    font: 14px/1.5 system-ui, sans-serif;
  }
  .tag-editor h1 { margin: 0 0 4px; font-size: 19px; font-weight: 650; }
  .tag-editor p { margin: 0 0 16px; }
  .tag-editor .tag-help { color: var(--rn-clr-content-secondary, GrayText); }
  .tag-list {
    display: grid;
    gap: 8px;
    max-height: 460px;
    overflow-y: auto;
    padding: 2px;
  }
  .tag-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 3px 6px;
    border: 1px solid transparent;
    border-radius: 8px;
  }
  .tag-row.is-selected { border-color: var(--rn-clr-border-primary, GrayText); }
  .tag-row input[type="text"] {
    box-sizing: border-box;
    width: 100%;
    min-height: 36px;
    padding: 6px 10px;
    border: 1px solid var(--rn-clr-border-primary, GrayText);
    border-radius: 6px;
    background: var(--rn-clr-background-primary, Canvas);
    color: inherit;
    font: inherit;
  }
  .tag-editor :focus-visible { outline: 2px solid var(--rn-clr-content-accent, Highlight); outline-offset: 2px; }
  .tag-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .tag-footer { justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--rn-clr-border-primary, GrayText); }
  .tag-editor button {
    min-height: 34px;
    padding: 5px 12px;
    border: 1px solid var(--rn-clr-border-primary, GrayText);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .tag-editor button:hover:not(:disabled) { background: var(--rn-clr-background-secondary, ButtonFace); }
  .tag-editor button:disabled { opacity: .45; cursor: default; }
  .tag-editor button.tag-save { background: #2357ba; color: white; border-color: transparent; }
  .tag-editor button.tag-save:hover:not(:disabled) { background: #19479e; }
  .tag-editor .tag-error { margin: 12px 0 0; }
  @media (max-width: 520px), (pointer: coarse) {
    .tag-editor { padding: 16px; }
    .tag-list { max-height: 240px; }
    .tag-row { padding-inline: 2px; }
    .tag-row input[type="text"] { font-size: 16px; }
    .tag-editor button, .tag-row input[type="text"] { min-height: 44px; }
    .tag-row input[type="radio"] { width: 24px; height: 24px; margin: 0; }
  }
`;

export function QuestionTagsEditor() {
  const plugin = usePlugin();
  const [rows, setRows] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(0);
  const focusId = useRef(null);
  const inputs = useRef(new Map());
  const addButton = useRef(null);

  useEffect(() => {
    let mounted = true;
    readQuestionTags(plugin).then(tags => {
      if (mounted) setRows((tags.length ? tags : ['']).map(tag => ({ id: nextId.current++, tag })));
    }).catch(error => {
      console.error('Could not load the tag list.', error);
      if (!mounted) return;
      setLoadFailed(true);
      setRows([]);
    });
    return () => { mounted = false; };
  }, [plugin]);

  useLayoutEffect(() => {
    if (focusId.current === null) return;
    inputs.current.get(focusId.current)?.focus();
    focusId.current = null;
  }, [rows]);

  function addTag() {
    const id = nextId.current++;
    focusId.current = id;
    setRows(current => [...current, { id, tag: '' }]);
    setSelectedId(id);
  }

  function deleteTag() {
    setRows(current => current.filter(row => row.id !== selectedId));
    setSelectedId(null);
    addButton.current?.focus();
  }

  async function close() {
    try {
      await plugin.widget.closePopup();
    } catch (error) {
      console.error('Could not close the tag editor.', error);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!rows || saving) return;
    setSaving(true);
    setError('');
    try {
      const existing = loadFailed ? await readQuestionTags(plugin) : [];
      const tags = normalizeQuestionTags([...existing, ...rows.map(row => row.tag)]);
      await plugin.storage.setSynced(questionTagsStorageKey, tags);
    } catch {
      setError('Could not save the tags. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    await close();
  }

  return (
    <form className="tag-editor" aria-labelledby="tag-editor-title" onSubmit={save}>
      <style>{styles}</style>
      <h1 id="tag-editor-title">Tags for hiding flashcard questions</h1>
      <p className="tag-help">Enter tags that already exist in RemNote. For a nested tag, enter its full path, such as <code>Study &gt; Exam</code>.</p>
      {rows === null && !error && <p role="status">Loading tags…</p>}
      {loadFailed && <p role="status">Could not load saved tags. Saving will add new entries to the existing list.</p>}
      {rows?.length === 0 && !loadFailed && <p className="tag-help">The list is empty. All flashcard questions will be shown.</p>}
      {rows?.length > 0 && (
        <div className="tag-list" role="group" aria-label="Tags">
          {rows.map(({ id, tag }, index) => (
            <div className={id === selectedId ? 'tag-row is-selected' : 'tag-row'} key={id}>
              <input
                type="radio"
                name="selected-tag"
                aria-label={tag ? `Select ${tag}` : `Select tag ${index + 1}`}
                checked={id === selectedId}
                disabled={saving}
                onChange={() => setSelectedId(id)}
              />
              <input
                type="text"
                aria-label={`Tag ${index + 1}`}
                placeholder="Tag name"
                value={tag}
                disabled={saving}
                ref={element => {
                  if (element) inputs.current.set(id, element);
                  else inputs.current.delete(id);
                }}
                onFocus={() => setSelectedId(id)}
                onChange={event => {
                  const tag = event.target.value;
                  setRows(current => current.map(row => row.id === id ? { id, tag } : row));
                }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="tag-actions">
        <button type="button" ref={addButton} disabled={!rows || saving} onClick={addTag}>Add tag</button>
        <button type="button" disabled={selectedId === null || saving} onClick={deleteTag}>Remove tag</button>
      </div>
      {error && <p className="tag-error" role="alert">{error}</p>}
      <div className="tag-actions tag-footer">
        <button type="button" disabled={saving} onClick={close}>Cancel</button>
        <button type="submit" className="tag-save" disabled={!rows || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

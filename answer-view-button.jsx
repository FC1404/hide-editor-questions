import React from 'react';
import { usePlugin, useSessionStorageState } from '@remnote/plugin-sdk';
import { answerViewState, toggleAnswerViewMessage } from './answer-view.mjs';
import { questionTagsWidget } from './question-tags.mjs';

const buttonStyles = `
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  .answer-view-controls { display: flex; }
  .answer-view-button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    margin: 1px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--rn-clr-content-secondary, #85858f);
    cursor: pointer;
  }
  .answer-view-button:hover { background: #80808a26; }
  .answer-view-button:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
`;

export function AnswerViewButton() {
  const plugin = usePlugin();
  const [enabled] = useSessionStorageState(answerViewState, true);
  const label = enabled ? 'Show flashcard questions' : 'Hide flashcard questions';

  return (
    <div className="answer-view-controls">
      <style>{buttonStyles}</style>
      <button
        type="button"
        className="answer-view-button"
        aria-label="Hide flashcard questions"
        aria-pressed={enabled}
        title={label}
        onClick={() => {
          void plugin.messaging.broadcast({ type: toggleAnswerViewMessage }).catch(error => {
            console.error('Could not toggle the answer view.', error);
          });
        }}
      >
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {enabled ? (
            <>
              <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7" />
              <path d="M6.2 6.2C4.1 7.7 2.6 9.8 2 12c1.3 3.4 5.2 6 10 6 1.8 0 3.5-.4 4.9-1.1M10 6.2c.6-.1 1.3-.2 2-.2 4.8 0 8.7 2.6 10 6-.4 1.1-1.2 2.2-2.2 3.1" />
            </>
          ) : (
            <>
              <path d="M2 12c1.3-3.4 5.2-6 10-6s8.7 2.6 10 6c-1.3 3.4-5.2 6-10 6s-8.7-2.6-10-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          )}
        </svg>
      </button>
      <button
        type="button"
        className="answer-view-button"
        aria-label="Edit tags for hiding questions"
        title="Edit tags for hiding questions"
        onClick={() => {
          void plugin.widget.openPopup(questionTagsWidget, undefined, false).catch(error => {
            console.error('Could not open the tag editor.', error);
          });
        }}
      >
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h8l10 10a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L4 11V4z" />
          <circle cx="8" cy="8" r="1" />
        </svg>
      </button>
    </div>
  );
}

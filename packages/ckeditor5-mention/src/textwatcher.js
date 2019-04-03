/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module mention/textwatcher
 */

import mix from '@ckeditor/ckeditor5-utils/src/mix';
import EmitterMixin from '@ckeditor/ckeditor5-utils/src/emittermixin';

/**
 * Text watcher feature.
 * @private
 */
export default class TextWatcher {
	/**
	 * Creates a text watcher instance.
	 * @param {module:core/editor/editor~Editor} editor
	 * @param {Function} testCallback Function used to match the text.
	 * @param {Function} textMatcherCallback Function used to process matched text.
	 */
	constructor( editor, testCallback, textMatcherCallback ) {
		this.editor = editor;
		this.testCallback = testCallback;
		this.textMatcher = textMatcherCallback;

		this.hasMatch = false;

		this._startListening();
	}

	/**
	 * Last matched text.
	 *
	 * @property {String}
	 */
	get last() {
		return this._getText();
	}

	/**
	 * Starts listening the editor for typing & selection events.
	 *
	 * @private
	 */
	_startListening() {
		const editor = this.editor;

		editor.model.document.selection.on( 'change', ( evt, { directChange } ) => {
			// The indirect changes (ie on typing) are handled in document's change event.
			if ( !directChange ) {
				return;
			}

			this._evaluateTextBeforeSelection();
		} );

		editor.model.document.on( 'change', ( evt, batch ) => {
			if ( batch.type == 'transparent' ) {
				return;
			}

			const changes = Array.from( editor.model.document.differ.getChanges() );
			const entry = changes[ 0 ];

			// Typing is represented by only a single change.
			const isTypingChange = changes.length == 1 && entry.name == '$text' && entry.length == 1;

			if ( !isTypingChange ) {
				return;
			}

			this._evaluateTextBeforeSelection();
		} );
	}

	/**
	 * Checks the editor content for matched text.
	 *
	 * @fires matched
	 * @fires unmatched
	 *
	 * @private
	 */
	_evaluateTextBeforeSelection() {
		const text = this._getText();

		const textHasMatch = this.testCallback( text );

		if ( !textHasMatch && this.hasMatch ) {
			/**
			 * Fired whenever text doesn't match anymore. Fired only when text matcher was matched.
			 *
			 * @event unmatched
			 */
			this.fire( 'unmatched' );
		}

		this.hasMatch = textHasMatch;

		if ( textHasMatch ) {
			const matched = this.textMatcher( text );

			/**
			 * Fired whenever text matcher was matched.
			 *
			 * @event matched
			 */
			this.fire( 'matched', { text, matched } );
		}
	}

	/**
	 * Returns the text before the caret from the current selection block.
	 *
	 * @returns {String|undefined} Text from block or undefined if selection is not collapsed.
	 * @private
	 */
	_getText() {
		const editor = this.editor;
		const selection = editor.model.document.selection;

		// Do nothing if selection is not collapsed.
		if ( !selection.isCollapsed ) {
			return;
		}

		const block = selection.focus.parent;

		return getText( block ).slice( 0, selection.focus.offset );
	}
}

// Returns whole text from parent element by adding all data from text nodes together.
//
// @private
// @param {module:engine/model/element~Element} element
// @returns {String}
function getText( element ) {
	return Array.from( element.getChildren() ).reduce( ( a, b ) => a + b.data, '' );
}

mix( TextWatcher, EmitterMixin );


/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/image/imageinlineediting
 */

import { Plugin } from 'ckeditor5/src/core';

import {
	toImageWidget,
	createImageViewElement,
	getImageTypeMatcher,
	getViewImageFromWidget,
	determineImageTypeForInsertionAtSelection
} from './utils';
import { modelToViewAttributeConverter, srcsetAttributeConverter } from './converters';

import ImageEditing from './imageediting';
import ImageTypeCommand from './imagetypecommand';

import { UpcastWriter } from 'ckeditor5/src/engine';

/**
 * The image inline plugin.
 *
 * It registers:
 *
 * * `<imageInline>` as an inline element in the document schema, and allows `alt`, `src` and `srcset` attributes.
 * * converters for editing and data pipelines.
 * * {@link module:image/image/imagetypecommand~ImageTypeCommand `'imageTypeInline'`} command that converts block images into
 * inline images.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ImageInlineEditing extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ImageEditing ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ImageInlineEditing';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const schema = editor.model.schema;

		// Converters 'alt' and 'srcset' are added in 'ImageEditing' plugin.
		schema.register( 'imageInline', {
			isObject: true,
			isInline: true,
			allowWhere: '$text',
			allowAttributes: [ 'alt', 'src', 'srcset' ]
		} );

		this._setupConversion();

		if ( editor.plugins.has( 'ImageBlockEditing' ) ) {
			editor.commands.add( 'imageTypeInline', new ImageTypeCommand( this.editor, 'imageInline' ) );

			this._setupClipboardIntegration();
		}
	}

	/**
	 * TODO
	 *
	 * @private
	 */
	_setupConversion() {
		const editor = this.editor;
		const t = editor.t;
		const conversion = editor.conversion;

		conversion.for( 'dataDowncast' )
			.elementToElement( {
				model: 'imageInline',
				view: ( modelElement, { writer } ) => writer.createEmptyElement( 'img' )
			} );

		conversion.for( 'editingDowncast' )
			.elementToElement( {
				model: 'imageInline',
				view: ( modelElement, { writer } ) => toImageWidget(
					createImageViewElement( writer, 'imageInline' ), writer, t( 'inline image widget' )
				)
			} );

		conversion.for( 'downcast' )
			.add( modelToViewAttributeConverter( 'imageInline', 'src' ) )
			.add( modelToViewAttributeConverter( 'imageInline', 'alt' ) )
			.add( srcsetAttributeConverter( 'imageInline' ) );

		// More image related upcasts are in 'ImageEditing' plugin.
		conversion.for( 'upcast' )
			.elementToElement( {
				view: getImageTypeMatcher( 'imageInline', editor ),
				model: ( viewImage, { writer } ) => writer.createElement( 'imageInline', { src: viewImage.getAttribute( 'src' ) } )
			} );
	}

	/**
	 * TODO
	 *
	 * @private
	 */
	_setupClipboardIntegration() {
		const editor = this.editor;
		const model = editor.model;
		const editingView = editor.editing.view;

		this.listenTo( editor.plugins.get( 'ClipboardPipeline' ), 'inputTransformation', ( evt, data ) => {
			const docFragmentChildren = [ ...data.content.getChildren() ];
			let modelRange;

			// Make sure only <figure class="image"></figure> elements are dropped or pasted. Otherwise, if there some other HTML
			// mixed up, this should be handled as a regular paste.
			if ( !docFragmentChildren.every( item => item.is( 'element', 'figure' ) && item.hasClass( 'image' ) ) ) {
				return;
			}

			// When drag and dropping, data.targetRanges specifies where to drop because
			// this is usually a different place than the current model selection (the user
			// uses a drop marker to specify the drop location).
			if ( data.targetRanges ) {
				modelRange = editor.editing.mapper.toModelRange( data.targetRanges[ 0 ] );
			}
			// Pasting, however, always occurs at the current model selection.
			else {
				modelRange = model.document.selection.getFirstRange();
			}

			const selection = model.createSelection( modelRange );

			// Convert block images into inline images only when pasting or dropping into non-empty blocks
			// and when the block is not an object (e.g. pasting to replace another widget).
			if ( determineImageTypeForInsertionAtSelection( editor, selection ) === 'imageInline' ) {
				const writer = new UpcastWriter( editingView.document );
				const fragment = writer.createDocumentFragment();

				// Unwrap <figure class="image"><img .../></figure> -> <img ... />
				// but <figure class="image"><img .../><figcaption>...</figcaption></figure> -> stays the same
				const inlineViewImages = docFragmentChildren.map( blockViewImage => {
					if ( blockViewImage.childCount === 1 ) {
						return getViewImageFromWidget( blockViewImage );
					} else {
						return blockViewImage;
					}
				} );

				writer.appendChild( inlineViewImages, fragment );

				data.content = fragment;
			}
		} );
	}
}

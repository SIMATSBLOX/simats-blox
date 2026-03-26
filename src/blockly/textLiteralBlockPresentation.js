import * as Blockly from 'blockly';

const CHIP_EXT = 'hw_text_literal_chip';

let extensionRegistered = false;

/**
 * Re-register core `text` without `text_quotes` (removes decorative quote marks)
 * and tag the block SVG for compact chip-style CSS. Same field name / output / generators.
 */
export function registerTextLiteralPresentation() {
  if (!extensionRegistered) {
    Blockly.Extensions.register(CHIP_EXT, function hwTextLiteralChip() {
      const block = this;
      const orig = block.initSvg;
      if (typeof orig !== 'function') return;
      block.initSvg = function patchedInitSvg() {
        orig.call(this);
        this.getSvgRoot()?.classList?.add('hw-block-text-literal');
      };
    });
    extensionRegistered = true;
  }

  /* Re-apply on every registerAllBlocks() — defineBlocks(allLibraryBlocks) would restore quotes. */
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'text',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
      output: 'String',
      style: 'text_blocks',
      helpUrl: '%{BKY_TEXT_TEXT_HELPURL}',
      tooltip: '%{BKY_TEXT_TEXT_TOOLTIP}',
      extensions: ['parent_tooltip_when_inline', CHIP_EXT],
    },
  ]);
}

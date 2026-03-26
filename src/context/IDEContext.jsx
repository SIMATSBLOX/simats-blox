/**
 * Optional compatibility shim — the IDE uses Zustand (`useIdeStore`) as the
 * primary state container for toolbar, board, and console state.
 */
export { useIdeStore as useIDEStore } from '../store/ideStore.js';

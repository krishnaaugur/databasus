"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mount = mount;
const widget_1 = require("./widget");
/**
 * Mounts the Databasus Backup & Disaster Recovery UI into any DOM element.
 *
 * @example
 * ```typescript
 * import { Databasus } from '@databasus/sdk';
 *
 * // Mount using CSS selector
 * const widget = Databasus.mount('#backup-container', {
 *   tenantId: 'tenant-123',
 *   apiUrl: 'https://databasus-5nzt.onrender.com'
 * });
 *
 * // Or mount using a direct DOM element (e.g. React useRef)
 * const widget = Databasus.mount(containerRef.current, {
 *   tenantId: 'tenant-123'
 * });
 *
 * // Cleanup on unmount
 * widget.destroy();
 * ```
 */
function mount(target, options) {
    let element = null;
    if (typeof target === 'string') {
        element = document.querySelector(target);
        if (!element) {
            throw new Error(`[Databasus SDK] Target element with selector "${target}" was not found in the DOM.`);
        }
    }
    else if (target instanceof HTMLElement) {
        element = target;
    }
    else {
        throw new Error('[Databasus SDK] The first argument to Databasus.mount must be a valid CSS selector string or an HTMLElement.');
    }
    if (!options || !options.tenantId) {
        throw new Error('[Databasus SDK] A valid "tenantId" must be provided in the options for Databasus.mount().');
    }
    return new widget_1.DatabasusWidget(element, options);
}

import { DatabasusMountOptions, DatabasusWidgetInstance } from '../types';
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
export declare function mount(target: string | HTMLElement, options: DatabasusMountOptions): DatabasusWidgetInstance;

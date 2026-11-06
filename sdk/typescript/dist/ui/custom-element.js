"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const widget_1 = require("./widget");
if (typeof window !== 'undefined' && 'customElements' in window) {
    if (!customElements.get('databasus-widget')) {
        class DatabasusCustomElement extends HTMLElement {
            widget;
            connectedCallback() {
                const tenantId = this.getAttribute('tenant-id') || '';
                const apiUrl = this.getAttribute('api-url') || undefined;
                const theme = this.getAttribute('theme') || 'dark';
                if (tenantId) {
                    this.widget = new widget_1.DatabasusWidget(this, {
                        tenantId,
                        apiUrl,
                        theme,
                    });
                }
            }
            disconnectedCallback() {
                if (this.widget) {
                    this.widget.destroy();
                    this.widget = undefined;
                }
            }
        }
        customElements.define('databasus-widget', DatabasusCustomElement);
    }
}

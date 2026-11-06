import { DatabasusWidget } from './widget';

if (typeof window !== 'undefined' && 'customElements' in window) {
  if (!customElements.get('databasus-widget')) {
    class DatabasusCustomElement extends HTMLElement {
      private widget?: DatabasusWidget;

      connectedCallback() {
        const tenantId = this.getAttribute('tenant-id') || '';
        const apiUrl = this.getAttribute('api-url') || undefined;
        const theme = (this.getAttribute('theme') as 'dark' | 'light' | 'auto') || 'dark';

        if (tenantId) {
          this.widget = new DatabasusWidget(this, {
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


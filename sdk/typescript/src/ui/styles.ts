export function getWidgetStyles(): string {
  return `
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      color-scheme: dark light;
      width: 100%;
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .databasus-root {
      --bg-main: #090d16;
      --bg-card: rgba(18, 24, 38, 0.7);
      --bg-card-hover: rgba(28, 38, 58, 0.8);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-sub: #64748b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.12);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.12);

      background: var(--bg-main);
      color: var(--text-main);
      border-radius: 16px;
      border: 1px solid var(--border-color);
      padding: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    }

    .databasus-root[data-theme="light"] {
      --bg-main: #ffffff;
      --bg-card: #f8fafc;
      --bg-card-hover: #f1f5f9;
      --border-color: #e2e8f0;
      --border-focus: #6366f1;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-sub: #94a3b8;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }

    /* Header */
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .icon-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 8px 16px -4px rgba(99, 102, 241, 0.4);
    }

    .header-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-success {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-warning {
      background: var(--warning-bg);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .badge-danger {
      background: var(--danger-bg);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease-in-out;
      outline: none;
      user-select: none;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .btn-outline {
      background: var(--bg-card);
      border-color: var(--border-color);
      color: var(--text-main);
    }

    .btn-outline:hover:not(:disabled) {
      background: var(--bg-card-hover);
      border-color: var(--border-focus);
    }

    .btn-danger {
      background: var(--danger-bg);
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover:not(:disabled) {
      background: var(--danger);
      color: #ffffff;
    }

    .btn-icon {
      padding: 8px;
      border-radius: 8px;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      transition: border-color 0.15s ease;
    }

    .metric-card:hover {
      border-color: var(--border-focus);
    }

    .metric-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .metric-value {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
    }

    .metric-desc {
      font-size: 11px;
      color: var(--text-sub);
      margin-top: 4px;
    }

    /* Section Header */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Table */
    .table-container {
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow-x: auto;
      background: var(--bg-card);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }

    th {
      background: rgba(0, 0, 0, 0.2);
      color: var(--text-muted);
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }

    .databasus-root[data-theme="light"] th {
      background: rgba(0, 0, 0, 0.03);
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: var(--bg-card-hover);
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-icon {
      font-size: 28px;
      margin-bottom: 8px;
      opacity: 0.6;
    }

    /* Toast */
    .toast {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: #1e293b;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideIn 0.2s ease-out;
      z-index: 50;
    }

    .toast-success {
      border-left: 4px solid var(--success);
    }

    .toast-error {
      border-left: 4px solid var(--danger);
    }

    @keyframes slideIn {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Modal */
    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 100;
      animation: fadeIn 0.15s ease-out;
    }

    .modal-card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
    }

    .databasus-root[data-theme="light"] .modal-card {
      background: #ffffff;
      border-color: #cbd5e1;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 8px;
    }

    .modal-desc {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Spin utility */
    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
}


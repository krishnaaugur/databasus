import { DatabasusClient } from '../client';
import {
  BackupRecord,
  DatabasusMountOptions,
  DatabasusWidgetInstance,
  TenantBackupStatus,
} from '../types';
import { getWidgetStyles } from './styles';

export class DatabasusWidget implements DatabasusWidgetInstance {
  public readonly container: HTMLElement;
  public readonly shadowRoot: ShadowRoot;

  private client: DatabasusClient;
  private options: DatabasusMountOptions;
  private timerId?: ReturnType<typeof setInterval>;
  private toastTimerId?: ReturnType<typeof setTimeout>;

  private statusData: TenantBackupStatus | null = null;
  private isLoading = true;
  private isTriggering = false;
  private isRestoring = false;
  private modalState: { backupId: string; createdAt: string } | null = null;
  private toastState: { message: string; type: 'success' | 'error' } | null = null;

  constructor(container: HTMLElement, options: DatabasusMountOptions) {
    this.container = container;
    this.options = {
      theme: 'dark',
      refreshIntervalMs: 15000,
      showTriggerBackup: true,
      showRestoreAction: true,
      showScheduleToggle: true,
      ...options,
    };

    const apiUrl = options.apiUrl || 'https://databasus-5nzt.onrender.com';
    this.client = new DatabasusClient({
      baseUrl: apiUrl,
      token: options.token,
      email: options.email,
      password: options.password,
    });

    // Attach Shadow DOM for 100% CSS isolation
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Initial render and data load
    this.render();
    this.refresh();

    // Setup auto-polling if interval is set
    if (this.options.refreshIntervalMs && this.options.refreshIntervalMs > 0) {
      this.timerId = setInterval(() => {
        this.refreshSilently();
      }, this.options.refreshIntervalMs);
    }
  }

  public async refresh(): Promise<void> {
    this.isLoading = true;
    this.render();
    await this.fetchData();
    this.isLoading = false;
    this.render();
  }

  private async refreshSilently(): Promise<void> {
    await this.fetchData();
    this.render();
  }

  private async fetchData(): Promise<void> {
    try {
      this.statusData = await this.client.getTenantBackupStatus(this.options.tenantId);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Databasus SDK] Failed to fetch backup status:`, error.message);
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }

  public destroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
    if (this.toastTimerId) {
      clearTimeout(this.toastTimerId);
      this.toastTimerId = undefined;
    }
    this.shadowRoot.innerHTML = '';
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    if (this.toastTimerId) {
      clearTimeout(this.toastTimerId);
    }
    this.toastState = { message, type };
    this.render();

    this.toastTimerId = setTimeout(() => {
      this.toastState = null;
      this.render();
    }, 4000);
  }

  private async handleTriggerBackup(): Promise<void> {
    if (this.isTriggering) return;
    this.isTriggering = true;
    this.render();

    try {
      const databaseId = await this.client.triggerTenantBackup(this.options.tenantId);
      this.showToast('Backup initiated successfully. Snapshot is generating...', 'success');
      if (this.options.onBackupTriggered) {
        this.options.onBackupTriggered(databaseId);
      }
      // Re-fetch after short delay to show IN_PROGRESS state
      setTimeout(() => this.refresh(), 2000);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.showToast(`Backup failed: ${error.message}`, 'error');
      if (this.options.onError) {
        this.options.onError(error);
      }
    } finally {
      this.isTriggering = false;
      this.render();
    }
  }

  private async handleToggleSchedule(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    const isEnabled = target.checked;

    try {
      await this.client.toggleTenantBackup(this.options.tenantId, isEnabled);
      if (this.statusData) {
        this.statusData.isBackupEnabled = isEnabled;
      }
      this.showToast(
        isEnabled ? 'Automated backups enabled.' : 'Automated backups paused.',
        'success'
      );
      this.render();
    } catch (err: unknown) {
      target.checked = !isEnabled; // Revert checkbox
      const error = err instanceof Error ? err : new Error(String(err));
      this.showToast(`Failed to update schedule: ${error.message}`, 'error');
    }
  }

  private openRestoreModal(backupId: string, createdAt: string): void {
    this.modalState = { backupId, createdAt };
    this.render();
  }

  private closeRestoreModal(): void {
    this.modalState = null;
    this.render();
  }

  private async handleConfirmRestore(): Promise<void> {
    if (!this.modalState || this.isRestoring) return;
    const backupId = this.modalState.backupId;
    this.isRestoring = true;
    this.render();

    try {
      await this.client.restoreTenant(this.options.tenantId, { backupId });
      this.showToast('Database restore started. Tables are being re-populated.', 'success');
      if (this.options.onRestoreTriggered) {
        this.options.onRestoreTriggered(backupId);
      }
      this.closeRestoreModal();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.showToast(`Restore failed: ${error.message}`, 'error');
      if (this.options.onError) {
        this.options.onError(error);
      }
    } finally {
      this.isRestoring = false;
      this.render();
    }
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  private formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private render(): void {
    const theme =
      this.options.theme === 'auto'
        ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : this.options.theme || 'dark';

    const status = this.statusData;
    const isProtected = status?.isBackupEnabled ?? true;
    const totalBackups = status?.recentBackups?.length ?? 0;
    const lastBackup = status?.recentBackups?.[0];
    const totalSize = status?.recentBackups?.reduce((sum, b) => sum + (b.fileSizeBytes || 0), 0) ?? 0;

    const html = `
      <style>${getWidgetStyles()}</style>
      <div class="databasus-root" data-theme="${theme}">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            <div class="icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                <path d="M3 12A9 3 0 0 0 21 12"></path>
              </svg>
            </div>
            <div>
              <div class="header-title">
                ${this.options.title || `${status?.databaseName || this.options.tenantId} Backups`}
                <span class="badge ${isProtected ? 'badge-success' : 'badge-warning'}">
                  <span class="pulse-dot"></span>
                  ${isProtected ? 'Protected' : 'Paused'}
                </span>
              </div>
              <div class="header-subtitle">
                Automated PostgreSQL disaster recovery & S3 point-in-time snapshots
              </div>
            </div>
          </div>

          <div class="header-right">
            ${
              this.options.showTriggerBackup
                ? `
              <button class="btn btn-primary" id="btn-trigger" ${this.isTriggering ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${this.isTriggering ? 'spin' : ''}">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                ${this.isTriggering ? 'Creating Snapshot...' : 'Backup Now'}
              </button>
            `
                : ''
            }

            <button class="btn btn-outline btn-icon" id="btn-refresh" title="Refresh backup status" ${this.isLoading ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${this.isLoading ? 'spin' : ''}">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                <path d="M21 3v5h-5"></path>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                <path d="M3 21v-5h5"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              Total Snapshots
            </div>
            <div class="metric-value">${totalBackups}</div>
            <div class="metric-desc">Retained archives</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Last Backup
            </div>
            <div class="metric-value">${this.formatRelativeTime(lastBackup?.createdAt)}</div>
            <div class="metric-desc">${lastBackup?.status || 'No backups yet'}</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              Backup Storage
            </div>
            <div class="metric-value">${this.formatBytes(totalSize)}</div>
            <div class="metric-desc">Encrypted in S3 bucket</div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Schedule
            </div>
            <div class="metric-value">${status?.schedule?.type || 'DAILY'}</div>
            <div class="metric-desc">${status?.schedule?.timeOfDay || '02:00'} UTC</div>
          </div>
        </div>

        <!-- Section: Backup History Table -->
        <div class="section-header">
          <div class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Recent Snapshots & Restore Points
          </div>

          ${
            this.options.showScheduleToggle
              ? `
            <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-muted);cursor:pointer;">
              <input type="checkbox" id="toggle-schedule" ${isProtected ? 'checked' : ''} style="cursor:pointer;" />
              Automated daily schedule
            </label>
          `
              : ''
          }
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Snapshot Date</th>
                <th>Duration</th>
                <th>Archive Size</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                status?.recentBackups && status.recentBackups.length > 0
                  ? status.recentBackups
                      .map((backup: BackupRecord) => {
                        const isDone = backup.status === 'COMPLETED';
                        const isPending = backup.status === 'IN_PROGRESS';
                        const badgeClass = isDone ? 'badge-success' : isPending ? 'badge-warning' : 'badge-danger';

                        return `
                        <tr>
                          <td>
                            <span class="badge ${badgeClass}">
                              <span class="pulse-dot"></span>
                              ${backup.status}
                            </span>
                          </td>
                          <td>
                            <div style="font-weight:600;">${new Date(backup.createdAt).toLocaleString()}</div>
                            <div style="font-size:10px;color:var(--text-sub);">${backup.id}</div>
                          </td>
                          <td>${backup.durationMs ? `${(backup.durationMs / 1000).toFixed(1)}s` : '--'}</td>
                          <td style="font-variant-numeric:tabular-nums;font-weight:600;">
                            ${this.formatBytes(backup.fileSizeBytes)}
                          </td>
                          <td style="text-align:right;">
                            ${
                              this.options.showRestoreAction && isDone
                                ? `
                              <button class="btn btn-outline btn-restore" data-id="${backup.id}" data-date="${new Date(backup.createdAt).toLocaleString()}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <polyline points="1 4 1 10 7 10"></polyline>
                                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                </svg>
                                Restore
                              </button>
                            `
                                : ''
                            }
                          </td>
                        </tr>
                      `;
                      })
                      .join('')
                  : `
                  <tr>
                    <td colspan="5">
                      <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <div style="font-weight:600;margin-bottom:4px;">No backups yet for this tenant</div>
                        <div style="font-size:11px;color:var(--text-sub);">
                          Click &ldquo;Backup Now&rdquo; above to trigger your first snapshot to S3.
                        </div>
                      </div>
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>

        <!-- Toast Notification -->
        ${
          this.toastState
            ? `
          <div class="toast ${this.toastState.type === 'success' ? 'toast-success' : 'toast-error'}">
            <span>${this.toastState.type === 'success' ? '✓' : '⚠'}</span>
            <span>${this.toastState.message}</span>
          </div>
        `
            : ''
        }

        <!-- Restore Confirmation Modal -->
        ${
          this.modalState
            ? `
          <div class="modal-backdrop">
            <div class="modal-card">
              <div class="modal-title">Restore Database Snapshot?</div>
              <div class="modal-desc">
                You are about to restore the database to the snapshot created on 
                <strong>${this.modalState.createdAt}</strong>.
                <br /><br />
                <span style="color:var(--danger);font-weight:600;">Warning:</span>
                This will overwrite current tables and rollback data to this exact point in time.
              </div>
              <div class="modal-actions">
                <button class="btn btn-outline" id="modal-cancel" ${this.isRestoring ? 'disabled' : ''}>
                  Cancel
                </button>
                <button class="btn btn-danger" id="modal-confirm" ${this.isRestoring ? 'disabled' : ''}>
                  ${this.isRestoring ? 'Restoring...' : 'Yes, Restore Database'}
                </button>
              </div>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    this.shadowRoot.innerHTML = html;
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const btnTrigger = this.shadowRoot.getElementById('btn-trigger');
    if (btnTrigger) {
      btnTrigger.addEventListener('click', () => this.handleTriggerBackup());
    }

    const btnRefresh = this.shadowRoot.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.refresh());
    }

    const toggleSchedule = this.shadowRoot.getElementById('toggle-schedule');
    if (toggleSchedule) {
      toggleSchedule.addEventListener('change', (e) => this.handleToggleSchedule(e));
    }

    const restoreButtons = this.shadowRoot.querySelectorAll('.btn-restore');
    restoreButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement);
        const backupId = target.getAttribute('data-id') || '';
        const date = target.getAttribute('data-date') || '';
        this.openRestoreModal(backupId, date);
      });
    });

    const modalCancel = this.shadowRoot.getElementById('modal-cancel');
    if (modalCancel) {
      modalCancel.addEventListener('click', () => this.closeRestoreModal());
    }

    const modalConfirm = this.shadowRoot.getElementById('modal-confirm');
    if (modalConfirm) {
      modalConfirm.addEventListener('click', () => this.handleConfirmRestore());
    }
  }
}

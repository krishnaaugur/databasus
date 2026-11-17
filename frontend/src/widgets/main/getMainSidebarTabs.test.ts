import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { getMainSidebarTabs } from './getMainSidebarTabs';

const mockTranslate = ((key: string, defaultValue?: string) =>
  defaultValue || key) as unknown as TFunction;

describe('getMainSidebarTabs', () => {
  it('hides databases, api-docs, storages, and notifiers for super admin', () => {
    const onSelectTab = vi.fn();
    const tabs = getMainSidebarTabs({
      isSuperAdmin: true,
      hasSelectedWorkspace: true,
      onSelectTab,
      t: mockTranslate,
    });

    const databasesTab = tabs.find((tab) => tab.name === 'databases');
    const apiDocsTab = tabs.find((tab) => tab.name === 'api-docs');
    const storagesTab = tabs.find((tab) => tab.name === 'storages');
    const notifiersTab = tabs.find((tab) => tab.name === 'notifiers');

    expect(databasesTab?.isVisible).toBe(false);
    expect(apiDocsTab?.isVisible).toBe(false);
    expect(storagesTab?.isVisible).toBe(false);
    expect(notifiersTab?.isVisible).toBe(false);
  });

  it('keeps platform dashboard and tenants visible for super admin', () => {
    const onSelectTab = vi.fn();
    const tabs = getMainSidebarTabs({
      isSuperAdmin: true,
      hasSelectedWorkspace: false,
      onSelectTab,
      t: mockTranslate,
    });

    const adminDashboardTab = tabs.find((tab) => tab.name === 'admin-dashboard');
    const tenantsTab = tabs.find((tab) => tab.name === 'tenants');
    const globalSettingsTab = tabs.find((tab) => tab.name === 'databasus-settings');
    const usersTab = tabs.find((tab) => tab.name === 'users');

    expect(adminDashboardTab?.isVisible).toBe(true);
    expect(tenantsTab?.isVisible).toBe(true);
    expect(globalSettingsTab?.isVisible).toBe(true);
    expect(usersTab?.isVisible).toBe(true);
  });

  it('shows databases, api-docs, storages, and notifiers for workspace members when workspace is selected', () => {
    const onSelectTab = vi.fn();
    const tabs = getMainSidebarTabs({
      isSuperAdmin: false,
      hasSelectedWorkspace: true,
      onSelectTab,
      t: mockTranslate,
    });

    const databasesTab = tabs.find((tab) => tab.name === 'databases');
    const apiDocsTab = tabs.find((tab) => tab.name === 'api-docs');
    const storagesTab = tabs.find((tab) => tab.name === 'storages');
    const notifiersTab = tabs.find((tab) => tab.name === 'notifiers');
    const tenantsTab = tabs.find((tab) => tab.name === 'tenants');

    expect(databasesTab?.isVisible).toBe(true);
    expect(apiDocsTab?.isVisible).toBe(true);
    expect(storagesTab?.isVisible).toBe(true);
    expect(notifiersTab?.isVisible).toBe(true);
    expect(tenantsTab?.isVisible).toBe(false);
  });

  it('hides workspace-bound tabs for members without selected workspace while keeping databases visible', () => {
    const onSelectTab = vi.fn();
    const tabs = getMainSidebarTabs({
      isSuperAdmin: false,
      hasSelectedWorkspace: false,
      onSelectTab,
      t: mockTranslate,
    });

    const databasesTab = tabs.find((tab) => tab.name === 'databases');
    const apiDocsTab = tabs.find((tab) => tab.name === 'api-docs');
    const storagesTab = tabs.find((tab) => tab.name === 'storages');
    const notifiersTab = tabs.find((tab) => tab.name === 'notifiers');

    expect(databasesTab?.isVisible).toBe(true);
    expect(apiDocsTab?.isVisible).toBe(false);
    expect(storagesTab?.isVisible).toBe(false);
    expect(notifiersTab?.isVisible).toBe(false);
  });

  it('invokes onSelectTab when tab onClick handler is called', () => {
    const onSelectTab = vi.fn();
    const tabs = getMainSidebarTabs({
      isSuperAdmin: true,
      hasSelectedWorkspace: true,
      onSelectTab,
      t: mockTranslate,
    });

    const tenantsTab = tabs.find((tab) => tab.name === 'tenants');
    tenantsTab?.onClick();

    expect(onSelectTab).toHaveBeenCalledWith('tenants');
  });
});

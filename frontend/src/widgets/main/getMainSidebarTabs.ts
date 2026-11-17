/* eslint-disable i18next/no-literal-string -- Sidebar tab configuration */
import type { TFunction } from 'i18next';

import type { MainTab, SidebarTab } from './SidebarComponent';

interface MainSidebarTabsParams {
  isSuperAdmin: boolean;
  hasSelectedWorkspace: boolean;
  onSelectTab: (tab: MainTab) => void;
  t: TFunction;
}

export const getMainSidebarTabs = ({
  isSuperAdmin,
  hasSelectedWorkspace,
  onSelectTab,
  t,
}: MainSidebarTabsParams): SidebarTab[] => [
  {
    text: isSuperAdmin ? 'Platform Dashboard' : 'Dashboard',
    name: isSuperAdmin ? 'admin-dashboard' : 'dashboard',
    icon: '/icons/menu/dashboard-gray.svg',
    selectedIcon: '/icons/menu/dashboard-white.svg',
    onClick: () => onSelectTab(isSuperAdmin ? 'admin-dashboard' : 'dashboard'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: isSuperAdmin || hasSelectedWorkspace,
  },
  {
    text: 'Tenants',
    name: 'tenants',
    icon: '/icons/menu/tenants-gray.svg',
    selectedIcon: '/icons/menu/tenants-white.svg',
    onClick: () => onSelectTab('tenants'),
    isAdminOnly: true,
    marginTop: '0px',
    isVisible: isSuperAdmin,
  },
  {
    text: t('app.navigation.databases'),
    name: 'databases',
    icon: '/icons/menu/database-gray.svg',
    selectedIcon: '/icons/menu/database-white.svg',
    onClick: () => onSelectTab('databases'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: !isSuperAdmin,
  },
  {
    text: t('app.navigation.apiDocs', 'API & Integration'),
    name: 'api-docs',
    icon: '/icons/menu/api-gray.svg',
    selectedIcon: '/icons/menu/api-white.svg',
    onClick: () => onSelectTab('api-docs'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: !isSuperAdmin && hasSelectedWorkspace,
  },
  {
    text: t('app.navigation.storages'),
    name: 'storages',
    icon: '/icons/menu/storage-gray.svg',
    selectedIcon: '/icons/menu/storage-white.svg',
    onClick: () => onSelectTab('storages'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: !isSuperAdmin && hasSelectedWorkspace,
  },
  {
    text: t('app.navigation.notifiers'),
    name: 'notifiers',
    icon: '/icons/menu/notifier-gray.svg',
    selectedIcon: '/icons/menu/notifier-white.svg',
    onClick: () => onSelectTab('notifiers'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: !isSuperAdmin && hasSelectedWorkspace,
  },
  {
    text: t('app.navigation.workspaceSettings'),
    name: 'settings',
    icon: '/icons/menu/workspace-settings-gray.svg',
    selectedIcon: '/icons/menu/workspace-settings-white.svg',
    onClick: () => onSelectTab('settings'),
    isAdminOnly: false,
    marginTop: '0px',
    isVisible: hasSelectedWorkspace,
  },
  {
    text: t('app.navigation.profile'),
    name: 'profile',
    icon: '/icons/menu/profile-gray.svg',
    selectedIcon: '/icons/menu/profile-white.svg',
    onClick: () => onSelectTab('profile'),
    isAdminOnly: false,
    marginTop: '25px',
    isVisible: true,
  },
  {
    text: t('app.navigation.databasusSettings'),
    name: 'databasus-settings',
    icon: '/icons/menu/global-settings-gray.svg',
    selectedIcon: '/icons/menu/global-settings-white.svg',
    onClick: () => onSelectTab('databasus-settings'),
    isAdminOnly: true,
    marginTop: '0px',
    isVisible: true,
  },
  {
    text: t('app.navigation.users'),
    name: 'users',
    icon: '/icons/menu/user-card-gray.svg',
    selectedIcon: '/icons/menu/user-card-white.svg',
    onClick: () => onSelectTab('users'),
    isAdminOnly: true,
    marginTop: '0px',
    isVisible: true,
  },
];

/* eslint-disable i18next/no-literal-string -- Main screen UI */
import { ApartmentOutlined, LoadingOutlined, MenuOutlined } from '@ant-design/icons';
import { App, Button, Spin, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { APP_VERSION, CONTAINER_ARCH } from '../../constants';
import { type DiskUsage, diskApi } from '../../entity/disk';
import {
  type UserProfile,
  type UsersSettings,
  UserRole,
  WorkspaceRole,
  settingsApi,
  userApi,
} from '../../entity/users';
import {
  type WorkspaceResponse,
  workspaceApi,
} from '../../entity/workspaces';
import { ApiDocsComponent } from '../../features/api-docs';
import { DatabasesComponent } from '../../features/databases/ui/DatabasesComponent';
import { NotifiersComponent } from '../../features/notifiers/ui/NotifiersComponent';
import { SettingsComponent } from '../../features/settings';
import { StoragesComponent } from '../../features/storages/ui/StoragesComponent';
import { ProfileComponent } from '../../features/users';
import { UsersComponent } from '../../features/users/ui/UsersComponent';
import {
  CreateWorkspaceDialogComponent,
  SuperAdminDashboardComponent,
  TenantDashboardComponent,
  TenantsComponent,
  WorkspaceSettingsComponent,
} from '../../features/workspaces';
import { useIsMobile, useIsNewGitHubVersionAvailable, useScreenHeight } from '../../shared/hooks';
import { getWebsitePageUrl, translateApiError, useLocale } from '../../shared/i18n';
import { ThemeToggleComponent } from '../../shared/ui';
import { getDiskUsageValues } from './getDiskUsageValues';
import { getMainSidebarTabs } from './getMainSidebarTabs';
import { type MainTab, SidebarComponent } from './SidebarComponent';
import { WorkspaceSelectionComponent } from './WorkspaceSelectionComponent';

export const MainScreenComponent = () => {
  const { t } = useTranslation();
  const { locale, formatNumber } = useLocale();
  const { message } = App.useApp();
  const screenHeight = useScreenHeight();
  const isMobile = useIsMobile();
  const isNewGitHubVersionAvailable = useIsNewGitHubVersionAvailable();
  const contentHeight = screenHeight - (isMobile ? 70 : 95);

  const [selectedTab, setSelectedTab] = useState<MainTab>('databases');
  const [diskUsage, setDiskUsage] = useState<DiskUsage | undefined>(undefined);
  const [user, setUser] = useState<UserProfile | undefined>(undefined);
  const [globalSettings, setGlobalSettings] = useState<UsersSettings | undefined>(undefined);

  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceResponse | undefined>(
    undefined,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasInitializedTab, setHasInitializedTab] = useState(false);

  const loadData = async () => {
    setIsLoading(true);

    try {
      const [diskUsage, user, workspaces, settings] = await Promise.all([
        diskApi.getDiskUsage(),
        userApi.getCurrentUser(),
        workspaceApi.getWorkspaces(),
        settingsApi.getSettings(),
      ]);

      setDiskUsage(diskUsage);
      setUser(user);
      setWorkspaces(workspaces.workspaces);
      setGlobalSettings(settings);
    } catch (e) {
      message.error(translateApiError(e, t));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Set selected workspace if none selected and workspaces available
  useEffect(() => {
    if (!selectedWorkspace && workspaces.length > 0) {
      const previouslySelectedWorkspaceId = localStorage.getItem('selected_workspace_id');
      const previouslySelectedWorkspace = workspaces.find(
        (workspace) => workspace.id === previouslySelectedWorkspaceId,
      );
      const workspaceToSelect = previouslySelectedWorkspace || workspaces[0];
      setSelectedWorkspace(workspaceToSelect);
    }
  }, [workspaces, selectedWorkspace]);

  // Save selected workspace to localStorage
  useEffect(() => {
    if (selectedWorkspace) {
      localStorage.setItem('selected_workspace_id', selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (user && !hasInitializedTab) {
      setHasInitializedTab(true);
      if (user.role === UserRole.ADMIN) {
        setSelectedTab('admin-dashboard');
      } else {
        setSelectedTab('dashboard');
      }
    }
  }, [user, hasInitializedTab]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      const privateTenantResourceTabs: MainTab[] = [
        'databases',
        'storages',
        'notifiers',
        'api-docs',
      ];
      if (privateTenantResourceTabs.includes(selectedTab) && !selectedWorkspace?.userRole) {
        setSelectedTab('admin-dashboard');
      }
    }
  }, [user?.role, selectedTab, selectedWorkspace?.userRole]);

  const handleCreateWorkspace = () => {
    if (!canCreateWorkspace) return;
    setShowCreateWorkspaceDialog(true);
  };

  const handleWorkspaceCreated = async (newWorkspace: WorkspaceResponse) => {
    try {
      const workspacesResponse = await workspaceApi.getWorkspaces();
      setWorkspaces(workspacesResponse.workspaces);
      setSelectedWorkspace(newWorkspace);
      if (!isSuperAdmin) {
        setSelectedTab('databases');
      }
    } catch (e) {
      message.error(translateApiError(e, t));
    }
  };

  const isUsedMoreThan95Percent =
    diskUsage && diskUsage.usedSpaceBytes / diskUsage.totalSpaceBytes > 0.95;

  const isUsedMoreThan85Percent =
    diskUsage && diskUsage.usedSpaceBytes / diskUsage.totalSpaceBytes > 0.85;

  const isSuperAdmin = user?.role === UserRole.ADMIN;
  const isCanManageDBs = !isSuperAdmin && selectedWorkspace?.userRole !== WorkspaceRole.VIEWER;

  const canCreateWorkspace = Boolean(
    user?.role === UserRole.ADMIN ||
    globalSettings?.isMemberAllowedToCreateWorkspaces,
  );

  const tabs = getMainSidebarTabs({
    isSuperAdmin,
    hasSelectedWorkspace: Boolean(selectedWorkspace),
    onSelectTab: (tab) => setSelectedTab(tab),
    t,
  });

  return (
    <div style={{ height: screenHeight }} className="bg-[#f5f5f5] p-2 md:p-3 dark:bg-gray-900">
      <div className="mb-2 flex h-[50px] items-center rounded bg-white px-2 py-2 shadow md:mb-3 md:h-[60px] md:p-3 dark:bg-gray-800">
        <div className="flex items-center gap-2 hover:opacity-80 md:gap-3">
          <a href={getWebsitePageUrl('home', locale)} target="_blank" rel="noreferrer">
            <img className="h-[30px] w-[30px] p-1 md:h-[40px] md:w-[40px]" src="/logo.svg" />
          </a>
        </div>

        <div className="ml-2 flex-1 pr-2 md:ml-4 md:flex-initial md:pr-0">
          {!isLoading && (
            <WorkspaceSelectionComponent
              workspaces={workspaces}
              selectedWorkspace={selectedWorkspace}
              canCreateWorkspace={canCreateWorkspace}
              onCreateWorkspace={handleCreateWorkspace}
              onWorkspaceSelect={setSelectedWorkspace}
            />
          )}
        </div>

        <div className="ml-auto hidden items-center gap-5 md:flex">
          {isUsedMoreThan85Percent && (
            <Tooltip title={t('app.diskUsage.hint')}>
              <div
                className={`cursor-pointer text-center text-xs ${isUsedMoreThan95Percent ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <Trans
                  i18nKey="app.diskUsage.compactSummary"
                  values={getDiskUsageValues(diskUsage, formatNumber)}
                  components={{ lineBreak: <br /> }}
                />
              </div>
            </Tooltip>
          )}

          <div className="flex items-center gap-2">
            <ThemeToggleComponent />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: '20px' }} />}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mt-1"
          />
        </div>
      </div>

      {isLoading || !user ? (
        <div className="flex items-center justify-center py-2" style={{ height: contentHeight }}>
          <Spin indicator={<LoadingOutlined spin />} size="large" />
        </div>
      ) : (
        <div className="relative flex">
          <SidebarComponent
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            selectedTab={selectedTab}
            tabs={tabs}
            user={user}
            diskUsage={diskUsage}
            contentHeight={contentHeight}
          />

          {selectedTab === 'admin-dashboard' && (
            <div className="flex-1 md:pl-4">
              <SuperAdminDashboardComponent
                workspaces={workspaces}
                user={user}
                diskUsage={diskUsage}
                contentHeight={contentHeight}
                onCreateTenant={handleCreateWorkspace}
                onNavigateToTab={(tab: string) => setSelectedTab(tab as MainTab)}
                onRefreshWorkspaces={async () => {
                  const res = await workspaceApi.getWorkspaces();
                  setWorkspaces(res.workspaces);
                }}
              />
            </div>
          )}

          {selectedTab === 'tenants' && (
            <div className="flex-1 md:pl-4">
              <TenantsComponent
                workspaces={workspaces}
                contentHeight={contentHeight}
                onCreateTenant={handleCreateWorkspace}
                onRefreshWorkspaces={async () => {
                  const res = await workspaceApi.getWorkspaces();
                  setWorkspaces(res.workspaces);
                }}
              />
            </div>
          )}

          {selectedTab === 'profile' && (
            <div className="flex-1 md:pl-4">
              <ProfileComponent contentHeight={contentHeight} />
            </div>
          )}

          {selectedTab === 'databasus-settings' && (
            <div className="flex-1 md:pl-4">
              <SettingsComponent contentHeight={contentHeight} />
            </div>
          )}

          {selectedTab === 'users' && (
            <div className="flex-1 md:pl-4">
              <UsersComponent contentHeight={contentHeight} />
            </div>
          )}

          {(selectedTab === 'dashboard' ||
            selectedTab === 'databases' ||
            selectedTab === 'storages' ||
            selectedTab === 'notifiers' ||
            selectedTab === 'settings' ||
            selectedTab === 'api-docs') && (
            <>
              {workspaces.length === 0 ? (
                <div className="flex-1 md:pl-3">
                  {canCreateWorkspace ? (
                    <div
                      className="flex grow items-center justify-center rounded"
                      style={{ height: contentHeight }}
                    >
                      <Button
                        type="primary"
                        size="large"
                        onClick={handleCreateWorkspace}
                        className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
                      >
                        {t('app.workspaceSelection.create')}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex grow flex-col items-center justify-center rounded bg-white p-8 text-center shadow dark:bg-gray-800"
                      style={{ height: contentHeight }}
                    >
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-gray-700">
                        <ApartmentOutlined className="text-3xl text-blue-500" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {/* eslint-disable-next-line i18next/no-literal-string -- empty state header */}
                        {'No Workspaces Assigned'}
                      </h2>
                      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                        {/* eslint-disable-next-line i18next/no-literal-string -- empty state description */}
                        {
                          'You do not currently have access to any workspaces. An administrator must assign you to a workspace or grant you permissions before you can view databases or run backup tasks.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 md:pl-1">
                    {selectedTab === 'dashboard' && selectedWorkspace && (
                      <div className="flex-1 md:pl-3">
                        <TenantDashboardComponent
                          workspace={selectedWorkspace}
                          user={user}
                          contentHeight={contentHeight}
                          onNavigateToTab={(tab: string) => setSelectedTab(tab as MainTab)}
                          key={`dashboard-${selectedWorkspace.id}`}
                        />
                      </div>
                    )}
                    {selectedTab === 'api-docs' && selectedWorkspace && (
                      <div
                        className="flex-1 overflow-y-auto px-4 md:pl-3"
                        style={{ height: contentHeight }}
                      >
                        <ApiDocsComponent
                          workspaceId={selectedWorkspace.id}
                          workspaceName={selectedWorkspace.name}
                          user={user}
                          key={`api-docs-${selectedWorkspace.id}`}
                        />
                      </div>
                    )}
                    {selectedTab === 'notifiers' && selectedWorkspace && (
                      <NotifiersComponent
                        contentHeight={contentHeight}
                        workspace={selectedWorkspace}
                        isCanManageNotifiers={isCanManageDBs}
                        key={`notifiers-${selectedWorkspace.id}`}
                      />
                    )}
                    {selectedTab === 'storages' && selectedWorkspace && (
                      <StoragesComponent
                        contentHeight={contentHeight}
                        workspace={selectedWorkspace}
                        isCanManageStorages={isCanManageDBs}
                        key={`storages-${selectedWorkspace.id}`}
                      />
                    )}
                    {selectedTab === 'databases' && selectedWorkspace && (
                      <DatabasesComponent
                        contentHeight={contentHeight}
                        workspace={selectedWorkspace}
                        isCanManageDBs={isCanManageDBs}
                        onNavigateToApiDocs={() => setSelectedTab('api-docs')}
                        key={`databases-${selectedWorkspace.id}`}
                      />
                    )}

                    <div className="flex-1 md:pl-3">
                      {selectedTab === 'settings' && selectedWorkspace && user && (
                        <WorkspaceSettingsComponent
                          workspaceResponse={selectedWorkspace}
                          contentHeight={contentHeight}
                          user={user}
                          key={`settings-${selectedWorkspace.id}`}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div className="absolute bottom-1 left-2 mb-[0px] hidden text-sm text-gray-400 md:block">
            {/* eslint-disable-next-line i18next/no-literal-string -- version prefix */}
            {`v${APP_VERSION}`}
            <br />
            <span className="inline-flex items-center gap-1.5">
              {CONTAINER_ARCH}
              {isNewGitHubVersionAvailable && (
                <Tooltip title={t('app.navigation.newVersionAvailable')}>
                  <a
                    href="https://github.com/databasus/databasus/releases/latest"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </a>
                </Tooltip>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Create Workspace Dialog */}
      {showCreateWorkspaceDialog && user && globalSettings && (
        <CreateWorkspaceDialogComponent
          user={user}
          globalSettings={globalSettings}
          onClose={() => setShowCreateWorkspaceDialog(false)}
          onWorkspaceCreated={handleWorkspaceCreated}
          workspacesCount={workspaces.length}
        />
      )}
    </div>
  );
};

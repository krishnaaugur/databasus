import { CodeOutlined } from '@ant-design/icons';
import { Button, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { databaseApi } from '../../../entity/databases';
import type { Database } from '../../../entity/databases';
import type { WorkspaceResponse } from '../../../entity/workspaces';
import { useIsMobile } from '../../../shared/hooks';
import { translateApiError } from '../../../shared/i18n';
import { CreateDatabaseComponent } from './CreateDatabaseComponent';
import { DatabaseCardComponent } from './DatabaseCardComponent';
import { DatabaseComponent } from './DatabaseComponent';

interface Props {
  contentHeight: number;
  workspace: WorkspaceResponse;
  isCanManageDBs: boolean;
  onNavigateToApiDocs?: () => void;
}

// eslint-disable-next-line i18next/no-literal-string -- localStorage key
const SELECTED_DATABASE_STORAGE_KEY = 'selectedDatabaseId';

// A healthcheck can change a database's availability every minute, so the cards refresh twice as
// often to show the change within a minute.
const DATABASES_REFRESH_INTERVAL_MS = 30_000;

// eslint-disable-next-line i18next/no-literal-string -- DOM event name
const VISIBILITY_CHANGE_EVENT = 'visibilitychange';

export const DatabasesComponent = ({
  contentHeight,
  workspace,
  isCanManageDBs,
  onNavigateToApiDocs,
}: Props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isShowAddDatabase, setIsShowAddDatabase] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [isWideStep, setIsWideStep] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | undefined>(undefined);

  const updateSelectedDatabaseId = (databaseId: string | undefined) => {
    setSelectedDatabaseId(databaseId);
    if (databaseId) {
      localStorage.setItem(`${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`, databaseId);
    } else {
      localStorage.removeItem(`${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`);
    }
  };

  const loadDatabases = (isSilent = false, selectDatabaseId?: string) => {
    if (!isSilent) {
      setIsLoading(true);
    }

    databaseApi
      .getDatabases(workspace.id)
      .then((databases) => {
        setDatabases(databases);
        if (selectDatabaseId) {
          updateSelectedDatabaseId(selectDatabaseId);
        } else if (!selectedDatabaseId && !isSilent && !isMobile) {
          // On desktop, auto-select a database; on mobile, keep it unselected to show the list first
          const savedDatabaseId = localStorage.getItem(
            `${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`,
          );
          const databaseToSelect =
            savedDatabaseId && databases.some((db) => db.id === savedDatabaseId)
              ? savedDatabaseId
              : databases[0]?.id;
          updateSelectedDatabaseId(databaseToSelect);
        }
      })
      .catch((e) => {
        // A background refresh retries on its own; an alert every 30 seconds would only get in the way.
        if (!isSilent) {
          alert(translateApiError(e, t));
        }
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDatabases();

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'hidden') {
        loadDatabases(true);
      }
    };

    const interval = setInterval(refreshIfVisible, DATABASES_REFRESH_INTERVAL_MS);
    document.addEventListener(VISIBILITY_CHANGE_EVENT, refreshIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener(VISIBILITY_CHANGE_EVENT, refreshIfVisible);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-3 my-3 flex w-[250px] justify-center">
        <Spin />
      </div>
    );
  }

  const addDatabaseButton = (
    <Button
      type="primary"
      className="mb-2 w-full"
      onClick={() => {
        setHasConnectionError(false);
        setIsShowAddDatabase(true);
      }}
    >
      {t('databases.list.addDatabase')}
    </Button>
  );

  const filteredDatabases = databases.filter((database) =>
    database.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // On mobile, show either the list or the database details
  const showDatabaseList = !isMobile || !selectedDatabaseId;
  const showDatabaseDetails = selectedDatabaseId && (!isMobile || selectedDatabaseId);

  return (
    <>
      <div className="flex grow">
        {showDatabaseList && (
          <div
            className="w-full overflow-y-auto md:mx-3 md:w-[250px] md:min-w-[250px] md:pr-2"
            style={{ height: contentHeight }}
          >
            {databases.length >= 5 && (
              <>
                {isCanManageDBs && addDatabaseButton}

                <div className="mb-2">
                  <input
                    placeholder={t('databases.list.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-b border-gray-300 p-1 text-gray-500 outline-none dark:text-gray-400"
                  />
                </div>
              </>
            )}

            {filteredDatabases.length > 0
              ? filteredDatabases.map((database) => (
                  <DatabaseCardComponent
                    key={database.id}
                    database={database}
                    selectedDatabaseId={selectedDatabaseId}
                    setSelectedDatabaseId={updateSelectedDatabaseId}
                  />
                ))
              : searchQuery && (
                  <div className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('databases.list.noSearchResults', { query: searchQuery })}
                  </div>
                )}

            {databases.length < 5 && isCanManageDBs && addDatabaseButton}

            <div className="mx-3 text-center text-xs text-gray-500 dark:text-gray-400">
              {t('databases.list.description')}
            </div>
          </div>
        )}

        {showDatabaseDetails && (
          <div className="flex w-full flex-col md:flex-1">
            {isMobile && (
              <div className="mb-2">
                <Button
                  type="default"
                  onClick={() => updateSelectedDatabaseId(undefined)}
                  className="w-full"
                >
                  {t('databases.list.backToList')}
                </Button>
              </div>
            )}

            <DatabaseComponent
              contentHeight={isMobile ? contentHeight - 50 : contentHeight}
              databaseId={selectedDatabaseId}
              onDatabaseChanged={() => {
                loadDatabases();
              }}
              onDatabaseDeleted={() => {
                const remainingDatabases = databases.filter(
                  (database) => database.id !== selectedDatabaseId,
                );
                updateSelectedDatabaseId(remainingDatabases[0]?.id);
                loadDatabases();
              }}
              isCanManageDBs={isCanManageDBs}
            />
          </div>
        )}

        {!isMobile && databases.length === 0 && (
          <div
            className="flex flex-1 flex-col items-center justify-center rounded bg-white p-8 text-center shadow dark:bg-gray-800"
            style={{ height: contentHeight }}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-gray-700">
              <CodeOutlined className="text-3xl text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {/* eslint-disable-next-line i18next/no-literal-string -- empty state header */}
              {'Ready for SaaS Integration'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
              {/* eslint-disable-next-line i18next/no-literal-string -- empty state body */}
              {
                'Integrate automated database backups and restores into your project using your API credentials and client-side zero-knowledge encryption key.'
              }
            </p>
            {onNavigateToApiDocs && (
              <Button
                type="primary"
                size="large"
                className="mt-6 border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
                onClick={onNavigateToApiDocs}
              >
                {/* eslint-disable-next-line i18next/no-literal-string -- action button */}
                {'View API Documentation & Keys'}
              </Button>
            )}
          </div>
        )}
      </div>

      {isShowAddDatabase && (
        <Modal
          title={t('databases.create.title')}
          footer={<div />}
          open={isShowAddDatabase}
          onCancel={() => setIsShowAddDatabase(false)}
          maskClosable={false}
          closable={!hasConnectionError}
          width={hasConnectionError || isWideStep ? 640 : 420}
        >
          <div className="mt-5" />

          <CreateDatabaseComponent
            workspaceId={workspace.id}
            onCreated={(databaseId) => {
              loadDatabases(false, databaseId);
              setIsShowAddDatabase(false);
            }}
            onClose={() => setIsShowAddDatabase(false)}
            onConnectionErrorChange={setHasConnectionError}
            onWideStepChange={setIsWideStep}
          />
        </Modal>
      )}
    </>
  );
};

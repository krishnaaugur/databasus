import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { App, Button, Modal, Spin, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import type { LogicalBackup } from '../../../entity/backups/logical';
import { type Database, DatabaseType } from '../../../entity/databases';
import {
  RESTORE_STATUS_LABEL_KEYS,
  type Restore,
  RestoreStatus,
  restoreApi,
} from '../../../entity/restores';
import { translateApiError, useLocale } from '../../../shared/i18n';
import { ClipboardHelper } from '../../../shared/lib/ClipboardHelper';
import { getUserTimeFormat } from '../../../shared/time';
import { ConfirmationComponent } from '../../../shared/ui';
import { EditDatabaseSpecificDataComponent } from '../../databases/ui/edit/EditDatabaseSpecificDataComponent';

interface Props {
  database: Database;
  backup: LogicalBackup;
}

type DatabaseCredentials = {
  username?: string;
  host?: string;
  port?: number;
  password?: string;
};

const clearCredentials = <T extends DatabaseCredentials>(db: T | undefined): T | undefined => {
  if (!db) return undefined;
  return {
    ...db,
    username: undefined,
    host: undefined,
    port: undefined,
    password: undefined,
  } as T;
};

const createInitialEditingDatabase = (database: Database): Database => ({
  ...database,
  postgresqlLogical: clearCredentials(database.postgresqlLogical),
  mysql: clearCredentials(database.mysql),
  mariadb: clearCredentials(database.mariadb),
  mongodb: clearCredentials(database.mongodb),
});

const getRestorePayload = (database: Database, editingDatabase: Database) => {
  switch (database.type) {
    case DatabaseType.POSTGRES_LOGICAL:
      return { postgresql: editingDatabase.postgresqlLogical };
    case DatabaseType.MYSQL:
      return { mysql: editingDatabase.mysql };
    case DatabaseType.MARIADB:
      return { mariadb: editingDatabase.mariadb };
    case DatabaseType.MONGODB:
      return { mongodb: editingDatabase.mongodb };
    default:
      return {};
  }
};

export const RestoresComponent = ({ database, backup }: Props) => {
  const { t } = useTranslation();
  const { formatRelativeTime } = useLocale();
  const { message } = App.useApp();

  const [editingDatabase, setEditingDatabase] = useState<Database>(
    createInitialEditingDatabase(database),
  );

  const [restores, setRestores] = useState<Restore[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showingRestoreError, setShowingRestoreError] = useState<Restore | undefined>();

  const [isShowRestore, setIsShowRestore] = useState(false);

  const [cancellingRestoreId, setCancellingRestoreId] = useState<string | undefined>();
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [restoreToCancelId, setRestoreToCancelId] = useState<string | undefined>();

  const [isRestoringToOriginal, setIsRestoringToOriginal] = useState(false);
  const [showRestoreToOriginalConfirmation, setShowRestoreToOriginalConfirmation] = useState(false);

  const isReloadInProgress = useRef(false);

  const loadRestores = async () => {
    if (isReloadInProgress.current) {
      return;
    }

    isReloadInProgress.current = true;

    try {
      const restores = await restoreApi.getRestores(backup.id);
      setRestores(restores);
    } catch (e) {
      alert(translateApiError(e, t));
    }

    isReloadInProgress.current = false;
  };

  const restoreToOriginal = async () => {
    setIsRestoringToOriginal(true);
    try {
      await restoreApi.restoreBackup({
        backupId: backup.id,
        restoreToOriginalDatabase: true,
      });
      await loadRestores();
    } catch (e) {
      alert(translateApiError(e, t));
    } finally {
      setIsRestoringToOriginal(false);
    }
  };

  const restore = async (editingDatabase: Database) => {
    try {
      await restoreApi.restoreBackup({
        backupId: backup.id,
        ...getRestorePayload(database, editingDatabase),
      });
      await loadRestores();

      setIsShowRestore(false);
    } catch (e) {
      alert(translateApiError(e, t));
    }
  };

  const cancelRestore = async (restoreId: string) => {
    setCancellingRestoreId(restoreId);
    try {
      await restoreApi.cancelRestore(restoreId);
      await loadRestores();
    } catch (e) {
      alert(translateApiError(e, t));
    } finally {
      setCancellingRestoreId(undefined);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadRestores().finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      loadRestores();
    }, 1_000);

    return () => clearInterval(interval);
  }, [backup.id]);

  const isRestoreInProgress = restores.some(
    (restore) => restore.status === RestoreStatus.IN_PROGRESS,
  );

  if (isShowRestore) {
    return (
      <>
        <div className="my-5 text-sm">
          <Trans i18nKey="restores.targetDatabase.description" components={{ underline: <u /> }} />
          <br />
          <br />
          {t('restores.targetDatabase.notInUseHint')}
        </div>

        <EditDatabaseSpecificDataComponent
          database={editingDatabase}
          onCancel={() => setIsShowRestore(false)}
          isShowBackButton={false}
          onBack={() => setIsShowRestore(false)}
          saveButtonText={t('restores.targetDatabase.submit')}
          isSaveToApi={false}
          onSaved={(database) => {
            setEditingDatabase({ ...database });
            restore(database);
          }}
          isRestoreMode={true}
        />
      </>
    );
  }

  return (
    <div className="mt-5">
      {isLoading ? (
        <div className="flex w-full justify-center">
          <Spin />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              type="primary"
              danger
              disabled={isRestoreInProgress}
              loading={isRestoringToOriginal || isRestoreInProgress}
              onClick={() => setShowRestoreToOriginalConfirmation(true)}
            >
              {t('restores.targetDatabase.restoreToOriginal')}
            </Button>
            <Button
              className="w-full"
              type="default"
              disabled={isRestoreInProgress}
              onClick={() => setIsShowRestore(true)}
            >
              {t('restores.targetDatabase.select')}
            </Button>
          </div>

          {restores.length === 0 && (
            <div className="my-5 text-center text-gray-400">{t('restores.list.empty')}</div>
          )}

          <div className="mt-5">
            {restores.map((restore) => {
              let restoreDurationMs = 0;
              if (restore.status === RestoreStatus.IN_PROGRESS) {
                restoreDurationMs = Date.now() - new Date(restore.createdAt).getTime();
              } else {
                restoreDurationMs = restore.restoreDurationMs;
              }

              const minutes = Math.floor(restoreDurationMs / 60000);
              const seconds = Math.floor((restoreDurationMs % 60000) / 1000);
              const milliseconds = restoreDurationMs % 1000;
              // eslint-disable-next-line i18next/no-literal-string -- unit letters stay English in every language
              const duration = `${minutes}m ${seconds}s ${milliseconds}ms`;

              const backupDurationMs = backup.backupDurationMs;
              const expectedRestoreDurationMs = backupDurationMs * 5;
              // eslint-disable-next-line i18next/no-literal-string -- unit letters stay English in every language
              const expectedRestoreDuration = `${Math.floor(expectedRestoreDurationMs / 60000)}m ${Math.floor((expectedRestoreDurationMs % 60000) / 1000)}s`;

              return (
                <div key={restore.id} className="mb-1 rounded border border-gray-200 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex flex-1">
                      <div className="w-[75px] min-w-[75px] pr-2">{t('common.fields.status')}</div>

                      {restore.status === RestoreStatus.FAILED && (
                        <Tooltip title={t('restores.card.errorDetailsTooltip')}>
                          <div
                            className="flex cursor-pointer items-center text-red-600 underline"
                            onClick={() => setShowingRestoreError(restore)}
                          >
                            <ExclamationCircleOutlined
                              className="mr-2"
                              style={{ fontSize: 16, color: '#ff0000' }}
                            />

                            <div>{t(RESTORE_STATUS_LABEL_KEYS[restore.status])}</div>
                          </div>
                        </Tooltip>
                      )}

                      {restore.status === RestoreStatus.COMPLETED && (
                        <div className="flex items-center">
                          <CheckCircleOutlined
                            className="mr-2"
                            style={{ fontSize: 16, color: '#008000' }}
                          />

                          <div>{t(RESTORE_STATUS_LABEL_KEYS[restore.status])}</div>
                        </div>
                      )}

                      {restore.status === RestoreStatus.CANCELED && (
                        <div className="flex items-center text-gray-500">
                          <CloseCircleOutlined
                            className="mr-2"
                            style={{ fontSize: 16, color: '#808080' }}
                          />

                          <div>{t(RESTORE_STATUS_LABEL_KEYS[restore.status])}</div>
                        </div>
                      )}

                      {restore.status === RestoreStatus.IN_PROGRESS && (
                        <div className="flex items-center font-bold text-blue-600">
                          <SyncOutlined spin />
                          <span className="ml-2">
                            {t(RESTORE_STATUS_LABEL_KEYS[restore.status])}
                          </span>
                        </div>
                      )}
                    </div>

                    {restore.status === RestoreStatus.IN_PROGRESS && (
                      <div className="ml-2">
                        {cancellingRestoreId === restore.id ? (
                          <SyncOutlined spin style={{ fontSize: 16 }} />
                        ) : (
                          <Tooltip title={t('restores.card.cancelTooltip')}>
                            <CloseCircleOutlined
                              className="cursor-pointer"
                              onClick={() => {
                                if (cancellingRestoreId) return;
                                setRestoreToCancelId(restore.id);
                                setShowCancelConfirmation(true);
                              }}
                              style={{
                                color: '#ff0000',
                                fontSize: 16,
                                opacity: cancellingRestoreId ? 0.2 : 1,
                              }}
                            />
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mb-1 flex">
                    <div className="w-[75px] min-w-[75px] pr-2">{t('restores.card.startedAt')}</div>
                    <div>
                      {dayjs.utc(restore.createdAt).local().format(getUserTimeFormat().format)} (
                      {formatRelativeTime(dayjs.utc(restore.createdAt).local())})
                    </div>
                  </div>

                  {restore.status === RestoreStatus.IN_PROGRESS && (
                    <div className="flex">
                      <div className="w-[75px] min-w-[75px] pr-2">
                        {t('restores.card.duration')}
                      </div>
                      <div>
                        <div>{duration}</div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {t('restores.card.expectedDurationHint')}
                          <br />
                          <br />
                          {t('restores.card.expectedDurationLimit', {
                            duration: expectedRestoreDuration,
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showingRestoreError && (
        <Modal
          title={t('restores.errorDetails.title')}
          open={!!showingRestoreError}
          onCancel={() => setShowingRestoreError(undefined)}
          maskClosable={false}
          footer={
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                ClipboardHelper.copyToClipboard(showingRestoreError.failMessage || '');
                message.success(t('restores.errorDetails.copied'));
              }}
            >
              {t('common.actions.copy')}
            </Button>
          }
        >
          {showingRestoreError.failMessage?.includes('must be owner of extension') && (
            <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-600 dark:bg-yellow-900/30">
              <Trans
                i18nKey="restores.errorDetails.excludeExtensionsTip"
                components={{ bold: <strong /> }}
              />
            </div>
          )}
          <div className="overflow-y-auto text-sm whitespace-pre-wrap" style={{ height: '400px' }}>
            {showingRestoreError.failMessage}
          </div>
        </Modal>
      )}

      {showCancelConfirmation && (
        <ConfirmationComponent
          onConfirm={() => {
            setShowCancelConfirmation(false);
            if (restoreToCancelId) {
              cancelRestore(restoreToCancelId);
            }
            setRestoreToCancelId(undefined);
          }}
          onDecline={() => {
            setShowCancelConfirmation(false);
            setRestoreToCancelId(undefined);
          }}
          description={
            <>
              <div>
                <Trans
                  i18nKey="restores.cancelConfirmation.warning"
                  components={{ bold: <strong /> }}
                />
              </div>
              <div className="mt-5">{t('restores.cancelConfirmation.question')}</div>
            </>
          }
          actionText={t('restores.cancelConfirmation.confirm')}
          actionButtonColor="red"
        />
      )}

      {showRestoreToOriginalConfirmation && (
        <ConfirmationComponent
          onConfirm={() => {
            setShowRestoreToOriginalConfirmation(false);
            restoreToOriginal();
          }}
          onDecline={() => {
            setShowRestoreToOriginalConfirmation(false);
          }}
          description={
            <>
              <div className="font-semibold text-red-600">
                {t('restores.targetDatabase.restoreToOriginalWarningTitle')}
              </div>
              <div className="mt-2">
                <Trans
                  i18nKey="restores.targetDatabase.restoreToOriginalWarningBody"
                  values={{ name: database.name }}
                  components={{ bold: <strong /> }}
                />
              </div>
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                {t('restores.targetDatabase.restoreToOriginalWarningHint')}
              </div>
            </>
          }
          actionText={t('restores.targetDatabase.restoreToOriginalConfirmButton')}
          actionButtonColor="red"
        />
      )}
    </div>
  );
};

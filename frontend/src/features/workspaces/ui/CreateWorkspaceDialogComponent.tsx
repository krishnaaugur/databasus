/* eslint-disable i18next/no-literal-string -- workspace creation dialog */
import { CopyOutlined, LoadingOutlined } from '@ant-design/icons';
import { App, Button, Input, Modal } from 'antd';
import { Spin } from 'antd';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { type UserProfile, UserRole, type UsersSettings } from '../../../entity/users';
import type { WorkspaceResponse } from '../../../entity/workspaces';
import { workspaceApi } from '../../../entity/workspaces';
import { translateApiError } from '../../../shared/i18n';

interface Props {
  user: UserProfile;
  globalSettings: UsersSettings;

  onClose: () => void;
  onWorkspaceCreated: (workspace: WorkspaceResponse) => void;

  workspacesCount: number;
}

export const CreateWorkspaceDialogComponent = ({
  user,
  globalSettings,
  onClose,
  onWorkspaceCreated,
  workspacesCount,
}: Props) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [isCreating, setIsCreating] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState<WorkspaceResponse | null>(null);
  const [workspaceName, setWorkspaceName] = useState(
    workspacesCount === 0 ? t('workspaces.create.defaultName') : '',
  );
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const isAllowedToCreateWorkspaces =
    globalSettings.isMemberAllowedToCreateWorkspaces ||
    user.role === UserRole.ADMIN;

  const handleCreateWorkspace = async () => {
    if (!isAllowedToCreateWorkspaces) {
      message.error(t('workspaces.create.notAllowed', 'You are not allowed to create workspaces'));
      return;
    }

    if (!workspaceName.trim()) {
      message.error(t('workspaces.create.nameRequired'));
      return;
    }

    if (user.role === UserRole.ADMIN && !ownerEmail.trim()) {
      message.error('Please enter the workspace owner email address');
      return;
    }

    setIsCreating(true);

    try {
      const newWorkspace = await workspaceApi.createWorkspace({
        name: workspaceName.trim(),
        ownerEmail: user.role === UserRole.ADMIN ? ownerEmail.trim() : undefined,
        ownerPhone:
          user.role === UserRole.ADMIN && ownerPhone.trim() ? ownerPhone.trim() : undefined,
      });

      if (newWorkspace.invitationLink) {
        setCreatedWorkspace(newWorkspace);
      } else {
        message.success(t('workspaces.create.created'));
        onWorkspaceCreated(newWorkspace);
        onClose();
      }
    } catch (error) {
      message.error(translateApiError(error, t));
    } finally {
      setIsCreating(false);
    }
  };

  if (createdWorkspace?.invitationLink) {
    return (
      <Modal
        title="Workspace Created"
        open
        closable={false}
        footer={[
          <Button
            key="done"
            type="primary"
            onClick={() => {
              onWorkspaceCreated(createdWorkspace);
              onClose();
            }}
            className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
          >
            Done
          </Button>,
        ]}
      >
        <div className="py-2">
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
            <strong>Workspace &ldquo;{createdWorkspace.name}&rdquo; created!</strong>
            <p className="mt-1">
              An invitation has been dispatched to <strong>{ownerEmail}</strong>. You can also copy
              the link below to share it directly with the owner to create their password.
            </p>
          </div>

          <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Owner Invitation Link
          </label>
          <div className="flex gap-2">
            <Input value={createdWorkspace.invitationLink} readOnly />
            <Button
              type="default"
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(createdWorkspace.invitationLink || '');
                message.success('Invitation link copied to clipboard!');
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!isAllowedToCreateWorkspaces) {
    return (
      <Modal
        title={t('workspaces.create.permissionDenied.title')}
        open
        onCancel={onClose}
        footer={[
          <Button key="ok" type="primary" onClick={onClose}>
            {t('common.actions.ok')}
          </Button>,
        ]}
      >
        <p>{t('workspaces.create.permissionDenied.description')}</p>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('workspaces.create.title')}
      open
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isCreating}>
          {t('common.actions.cancel')}
        </Button>,

        <Button
          key="create"
          type="primary"
          onClick={handleCreateWorkspace}
          disabled={
            isCreating ||
            !workspaceName.trim() ||
            (user.role === UserRole.ADMIN && !ownerEmail.trim())
          }
          className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
        >
          {isCreating ? (
            <Spin indicator={<LoadingOutlined spin />} size="small" />
          ) : (
            t('workspaces.create.submit')
          )}
        </Button>,
      ]}
    >
      <div className="mb-4">
        {user.role === UserRole.ADMIN && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            <div className="font-semibold">Tenant Privacy &amp; Zero-Knowledge Security</div>
            <p className="mt-1">
              Assign the workspace owner below. The owner will have exclusive access to generate API
              keys and manage database credentials. Platform super admins cannot generate or view
              workspace API keys or database credentials.
            </p>
          </div>
        )}

        <div className="dark:text-gray-300">
          <Trans i18nKey="workspaces.create.description" components={{ lineBreak: <br /> }} />
        </div>

        <label className="mt-5 mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('workspaces.fields.name')}
        </label>
        <Input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder={t('workspaces.fields.namePlaceholder')}
          disabled={isCreating}
          onPressEnter={handleCreateWorkspace}
          autoFocus
        />

        {user.role === UserRole.ADMIN && (
          <>
            <label className="mt-4 mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Workspace Owner Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="e.g. tenant-admin@client.com"
              disabled={isCreating}
            />

            <label className="mt-4 mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Workspace Owner Mobile Number{' '}
              <span className="text-xs font-normal text-gray-400">(Optional, for SMS OTP)</span>
            </label>
            <Input
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="e.g. +1 555-0199"
              disabled={isCreating}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

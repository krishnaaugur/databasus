/* eslint-disable i18next/no-literal-string -- API credentials and developer keys UI */
import { CopyOutlined, DeleteOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { type ApiKey, type CreateApiKeyResponse, apiKeysApi } from '../../../entity/api-keys';
import { ClipboardHelper } from '../../../shared/lib/ClipboardHelper';

interface Props {
  workspaceId?: string;
}

export function ApiKeysComponent({ workspaceId }: Props) {
  const { message } = App.useApp();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(null);

  const [form] = Form.useForm();

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const data = await apiKeysApi.getApiKeys(workspaceId);
      setKeys(data);
    } catch {
      // Ignore if endpoint not mounted yet
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [workspaceId]);

  const handleCreate = async (values: { name: string; role: string }) => {
    setIsCreating(true);
    try {
      const created = await apiKeysApi.createApiKey({
        name: values.name,
        workspaceId,
        role: values.role || 'WORKSPACE_ADMIN',
      });
      setNewKeyResult(created);
      form.resetFields();
      await loadKeys();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiKeysApi.revokeApiKey(id);
      message.success('API key revoked');
      await loadKeys();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <span className="font-semibold text-gray-900 dark:text-white">{name}</span>
      ),
    },
    {
      title: 'Key ID',
      dataIndex: 'keyId',
      key: 'keyId',
      render: (keyId: string) => (
        <div className="flex items-center space-x-2">
          <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs dark:bg-gray-700">
            {keyId}
          </code>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              ClipboardHelper.copyToClipboard(keyId);
              message.success('Key ID copied');
            }}
          />
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span className="text-xs text-gray-500">{dayjs(date).format('YYYY-MM-DD HH:mm')}</span>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date?: string) => (
        <span className="text-xs text-gray-500">{date ? dayjs(date).fromNow() : 'Never'}</span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="Revoke API Key"
          description="Any client using this key will immediately lose access. Continue?"
          onConfirm={() => handleRevoke(record.id)}
          okText="Revoke"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="my-8 max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold dark:text-white">API Keys & Programmatic Access</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Manage programmatic API credentials for external applications (e.g. multi-tenant SaaS,
            CI/CD pipelines).
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setNewKeyResult(null);
            setIsModalOpen(true);
          }}
          className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
        >
          Create API Key
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center">
          <Spin indicator={<LoadingOutlined spin />} />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={keys}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: 'No API keys generated yet' }}
        />
      )}

      {/* Creation Modal */}
      <Modal
        title={newKeyResult ? 'API Key Created' : 'Create New API Key'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setNewKeyResult(null);
        }}
        footer={null}
        destroyOnClose
      >
        {newKeyResult ? (
          <div className="space-y-4 pt-2">
            <Alert
              type="warning"
              showIcon
              message="Save your Secret now!"
              description="This is the only time your API Secret will be displayed. Store it securely in your environment variables."
            />

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Key ID (Public)
              </label>
              <div className="mt-1 flex items-center space-x-2">
                <Input value={newKeyResult.keyId} readOnly className="font-mono text-xs" />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    ClipboardHelper.copyToClipboard(newKeyResult.keyId);
                    message.success('Key ID copied');
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                API Secret (Private)
              </label>
              <div className="mt-1 flex items-center space-x-2">
                <Input.Password
                  value={newKeyResult.secret}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    ClipboardHelper.copyToClipboard(newKeyResult.secret);
                    message.success('API Secret copied');
                  }}
                />
              </div>
            </div>

            {newKeyResult.encryptionKey && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-red-600 uppercase dark:text-red-400">
                    One-Time Encryption Key (Zero-Knowledge)
                  </label>
                  <span className="text-[10px] text-red-500">
                    Generated once • Cannot be recovered
                  </span>
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <Input.Password
                    value={newKeyResult.encryptionKey}
                    readOnly
                    className="border-red-300 font-mono text-xs dark:border-red-700"
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      ClipboardHelper.copyToClipboard(newKeyResult.encryptionKey!);
                      message.success('Encryption Key copied');
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Your project backups will be encrypted with this key. The platform never stores
                  this key.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">
                Bearer Header Format
              </label>
              <div className="mt-1 flex items-center space-x-2">
                <Input
                  value={`Bearer ${newKeyResult.keyId}:${newKeyResult.secret}`}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    ClipboardHelper.copyToClipboard(
                      `Bearer ${newKeyResult.keyId}:${newKeyResult.secret}`,
                    );
                    message.success('Bearer header string copied');
                  }}
                />
              </div>
            </div>

            <div className="pt-3 text-right">
              <Button
                type="primary"
                onClick={() => {
                  setIsModalOpen(false);
                  setNewKeyResult(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleCreate} className="pt-2">
            <Form.Item
              name="name"
              label="Key Name / Client Description"
              rules={[{ required: true, message: 'Please enter a name for this API key' }]}
            >
              <Input placeholder="e.g. multi-tenant-saas-prod" />
            </Form.Item>

            <Form.Item name="role" label="Role" initialValue="WORKSPACE_ADMIN">
              <Select>
                <Select.Option value="WORKSPACE_ADMIN">
                  Workspace Admin (Full access within workspace)
                </Select.Option>
                <Select.Option value="WORKSPACE_MEMBER">
                  Workspace Member (Trigger backups, view status)
                </Select.Option>
                <Select.Option value="WORKSPACE_VIEWER">Workspace Viewer (Read only)</Select.Option>
              </Select>
            </Form.Item>

            <div className="flex justify-end space-x-2 pt-2">
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isCreating}>
                Generate Key
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}

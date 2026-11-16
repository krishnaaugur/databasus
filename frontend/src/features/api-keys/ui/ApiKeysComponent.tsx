/* eslint-disable i18next/no-literal-string -- API credentials and developer keys UI */
import {
  CopyOutlined,
  DeleteOutlined,
  LoadingOutlined,
  MailOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { type ApiKey, type CreateApiKeyResponse, apiKeysApi } from '../../../entity/api-keys';
import { type UserProfile, UserRole } from '../../../entity/users';
import { ClipboardHelper } from '../../../shared/lib/ClipboardHelper';

interface Props {
  workspaceId?: string;
  user?: UserProfile;
}

export function ApiKeysComponent({ workspaceId, user }: Props) {
  const { message } = App.useApp();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(null);

  // OTP Verification state
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpRecipient, setOtpRecipient] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [form] = Form.useForm();

  // Cooldown countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadKeys = async () => {
    if (user?.role === UserRole.ADMIN) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiKeysApi.getApiKeys(workspaceId);
      setKeys(data);
    } catch {
      // Ignore if endpoint not mounted or permissions restricted
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [workspaceId, user?.role]);

  const handleSendOtp = async () => {
    if (!workspaceId) {
      message.error('A workspace must be selected to request an API key verification code');
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await apiKeysApi.requestOtp(workspaceId);
      setOtpSent(true);
      setOtpRecipient(res.recipientMasked);
      setCountdown(60);
      message.success(`Verification code sent to ${res.recipientMasked}`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleCreate = async (values: { name: string; role: string; otp: string }) => {
    if (!values.otp || values.otp.trim().length !== 6) {
      message.error('Please enter the 6-digit verification code sent to your email');
      return;
    }
    setIsCreating(true);
    try {
      const created = await apiKeysApi.createApiKey({
        name: values.name,
        workspaceId,
        role: values.role || 'WORKSPACE_ADMIN',
        otp: values.otp.trim(),
      });
      setNewKeyResult(created);
      form.resetFields();
      setOtpSent(false);
      setOtpRecipient('');
      setCountdown(0);
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

  // If user is Super Admin, enforce strict auditing mode
  if (user?.role === UserRole.ADMIN) {
    return (
      <div className="my-8 max-w-4xl">
        <div className="mb-4">
          <h2 className="text-xl font-bold dark:text-white">API Keys &amp; Programmatic Access</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Programmatic API credentials and automated access tokens.
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
          <div className="flex items-center space-x-2 font-semibold">
            <SafetyCertificateOutlined className="text-base text-blue-600 dark:text-blue-400" />
            <span>Tenant Privacy &amp; Zero-Knowledge Isolation Enforced</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-blue-800 dark:text-blue-300">
            Platform administrators cannot generate, view, or manage tenant workspace API keys or
            database credentials. Only the assigned tenant Workspace Owner and authorized workspace
            members can access and generate programmatic credentials after completing one-time
            password (OTP) verification.
          </p>
        </div>
      </div>
    );
  }

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
          <h2 className="text-xl font-bold dark:text-white">API Keys &amp; Programmatic Access</h2>
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
            setOtpSent(false);
            setOtpRecipient('');
            form.resetFields();
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
        title={newKeyResult ? 'API Key Created' : 'Create New API Key (OTP Protected)'}
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

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-900 dark:text-white">
                    <MailOutlined />
                    <span>One-Time Password (OTP) Verification</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {otpSent
                      ? `Code sent to ${otpRecipient} (valid 10m)`
                      : 'Required to authorize new API key creation.'}
                  </div>
                </div>
                <Button
                  size="small"
                  onClick={handleSendOtp}
                  loading={isSendingOtp}
                  disabled={countdown > 0}
                  className="text-xs"
                >
                  {countdown > 0 ? `Resend (${countdown}s)` : otpSent ? 'Resend Code' : 'Send Code'}
                </Button>
              </div>

              {otpSent && (
                <Form.Item
                  name="otp"
                  label="6-Digit Verification Code"
                  className="mt-3 mb-0"
                  rules={[
                    { required: true, message: 'Please enter the 6-digit verification code' },
                    { len: 6, message: 'Verification code must be exactly 6 digits' },
                  ]}
                >
                  <Input
                    placeholder="e.g. 123456"
                    maxLength={6}
                    className="text-center font-mono text-base tracking-widest"
                  />
                </Form.Item>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating}
                disabled={!otpSent}
                className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
              >
                Verify &amp; Generate Key
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}

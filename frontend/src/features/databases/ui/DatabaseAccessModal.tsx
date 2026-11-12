import {
  DeleteOutlined,
  KeyOutlined,
  LoadingOutlined,
  PlusOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  Form,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';

import { apiKeysApi, type ApiKey } from '../../../entity/api-keys';
import {
  databaseAccessApi,
  type DatabaseAccessControl,
  type SetDatabaseAccessRequest,
} from '../../../entity/database-access';
import { workspaceMembershipApi, type WorkspaceMemberResponse } from '../../../entity/workspaces';

interface Props {
  databaseId: string;
  databaseName: string;
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export function DatabaseAccessModal({
  databaseId,
  databaseName,
  workspaceId,
  open,
  onClose,
}: Props) {
  const { message } = App.useApp();
  const [permissions, setPermissions] = useState<DatabaseAccessControl[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberResponse[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form] = Form.useForm();
  const [targetType, setTargetType] = useState<'USER' | 'API_KEY'>('USER');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [perms, membersRes, keys] = await Promise.all([
        databaseAccessApi.listPermissions(databaseId, workspaceId).catch(() => []),
        workspaceMembershipApi.getMembers(workspaceId).catch(() => ({ members: [] })),
        apiKeysApi.getApiKeys(workspaceId).catch(() => []),
      ]);
      setPermissions(perms);
      setMembers(membersRes.members || []);
      setApiKeys(keys);
    } catch {
      // Ignore if endpoint not loaded
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, databaseId, workspaceId]);

  const handleAddRule = async (values: {
    targetId: string;
    canView: boolean;
    canBackup: boolean;
    canRestore: boolean;
    canManage: boolean;
  }) => {
    setIsSaving(true);
    try {
      const req: SetDatabaseAccessRequest = {
        canView: values.canView ?? true,
        canBackup: values.canBackup ?? true,
        canRestore: values.canRestore ?? false,
        canManage: values.canManage ?? false,
      };

      if (targetType === 'USER') {
        req.userId = values.targetId;
      } else {
        req.apiKeyId = values.targetId;
      }

      await databaseAccessApi.setPermissions(databaseId, workspaceId, req);
      message.success('Access rule saved');
      form.resetFields();
      await loadData();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to save access rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (permId: string) => {
    try {
      await databaseAccessApi.deletePermission(databaseId, permId, workspaceId);
      message.success('Access rule removed');
      await loadData();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to remove access rule');
    }
  };

  const columns: ColumnsType<DatabaseAccessControl> = [
    {
      title: 'Principal',
      key: 'principal',
      render: (_, r) => {
        if (r.userId) {
          return (
            <div className="flex items-center space-x-1.5">
              <UserOutlined className="text-blue-500" />
              <span>{r.userEmail || r.userName || r.userId}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center space-x-1.5">
            <KeyOutlined className="text-purple-500" />
            <span>{r.apiKeyName || r.apiKeyPublic || r.apiKeyId}</span>
            <Tag color="purple">API Key</Tag>
          </div>
        );
      },
    },
    {
      title: 'View',
      dataIndex: 'canView',
      key: 'canView',
      render: (v: boolean) => (v ? <Tag color="green">Allowed</Tag> : <Tag color="red">Denied</Tag>),
    },
    {
      title: 'Backup',
      dataIndex: 'canBackup',
      key: 'canBackup',
      render: (v: boolean) => (v ? <Tag color="green">Allowed</Tag> : <Tag color="red">Denied</Tag>),
    },
    {
      title: 'Restore',
      dataIndex: 'canRestore',
      key: 'canRestore',
      render: (v: boolean) => (v ? <Tag color="green">Allowed</Tag> : <Tag color="red">Denied</Tag>),
    },
    {
      title: 'Manage',
      dataIndex: 'canManage',
      key: 'canManage',
      render: (v: boolean) => (v ? <Tag color="green">Allowed</Tag> : <Tag color="red">Denied</Tag>),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Popconfirm
          title="Remove rule"
          description="Fall back to workspace default permissions?"
          onConfirm={() => handleDeleteRule(r.id)}
          okText="Remove"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <SafetyOutlined className="text-blue-600" />
          <span>Access Control & Permissions: {databaseName}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={720}
      destroyOnClose
    >
      <div className="space-y-6 pt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Super Admins always have full access. Use these rules to grant or restrict specific team
          members or API keys on this database.
        </p>

        {isLoading ? (
          <div className="py-6 text-center">
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={permissions}
            rowKey="id"
            pagination={false}
            size="small"
            locale={{ emptyText: 'No database-specific overrides. Default workspace roles apply.' }}
          />
        )}

        {/* Add Permission Rule */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Add or Override Permission
          </h3>

          <div className="mb-3 flex space-x-2">
            <Button
              size="small"
              type={targetType === 'USER' ? 'primary' : 'default'}
              onClick={() => {
                setTargetType('USER');
                form.resetFields(['targetId']);
              }}
            >
              Workspace Member
            </Button>
            <Button
              size="small"
              type={targetType === 'API_KEY' ? 'primary' : 'default'}
              onClick={() => {
                setTargetType('API_KEY');
                form.resetFields(['targetId']);
              }}
            >
              API Key
            </Button>
          </div>

          <Form form={form} layout="vertical" onFinish={handleAddRule}>
            <Form.Item
              name="targetId"
              label={targetType === 'USER' ? 'Select Member' : 'Select API Key'}
              rules={[{ required: true, message: 'Please select a principal' }]}
            >
              <Select placeholder={targetType === 'USER' ? 'Select member...' : 'Select API key...'}>
                {targetType === 'USER'
                  ? members.map((m) => (
                      <Select.Option key={m.userId} value={m.userId}>
                        {m.email} ({m.role})
                      </Select.Option>
                    ))
                  : apiKeys.map((k) => (
                      <Select.Option key={k.id} value={k.id}>
                        {k.name} ({k.keyId})
                      </Select.Option>
                    ))}
              </Select>
            </Form.Item>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Form.Item name="canView" valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Can View</Checkbox>
              </Form.Item>
              <Form.Item name="canBackup" valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Can Backup</Checkbox>
              </Form.Item>
              <Form.Item name="canRestore" valuePropName="checked" initialValue={false} noStyle>
                <Checkbox>Can Restore</Checkbox>
              </Form.Item>
              <Form.Item name="canManage" valuePropName="checked" initialValue={false} noStyle>
                <Checkbox>Can Manage</Checkbox>
              </Form.Item>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              icon={<PlusOutlined />}
              loading={isSaving}
              className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
            >
              Save Permission
            </Button>
          </Form>
        </div>
      </div>
    </Modal>
  );
}


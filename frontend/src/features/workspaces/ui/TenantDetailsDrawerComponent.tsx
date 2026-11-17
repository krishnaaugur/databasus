/* eslint-disable i18next/no-literal-string -- Tenant details drawer UI */
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  HddOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  App,
  Badge,
  Card,
  Descriptions,
  Drawer,
  Empty,
  List,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import type { GetAuditLogsResponse } from '../../../entity/audit-logs/model/GetAuditLogsResponse';
import { WorkspaceRole } from '../../../entity/users/model/WorkspaceRole';
import {
  type WorkspaceMemberResponse,
  type WorkspaceResponse,
  type WorkspaceTelemetry,
  workspaceApi,
  workspaceMembershipApi,
} from '../../../entity/workspaces';

const { Text, Title } = Typography;

interface Props {
  open: boolean;
  workspace: WorkspaceResponse | null;
  telemetry?: WorkspaceTelemetry;
  onClose: () => void;
}

export function TenantDetailsDrawerComponent({
  open,
  workspace,
  telemetry,
  onClose,
}: Props) {
  const { message } = App.useApp();
  const [members, setMembers] = useState<WorkspaceMemberResponse[]>([]);
  const [auditLogs, setAuditLogs] = useState<GetAuditLogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!open || !workspace) {
      setMembers([]);
      setAuditLogs(null);
      return;
    }

    const loadDetails = async () => {
      setIsLoading(true);
      try {
        const [membersRes, auditRes] = await Promise.all([
          workspaceMembershipApi.getMembers(workspace.id),
          workspaceApi.getWorkspaceAuditLogs(workspace.id, { limit: 20 }),
        ]);
        setMembers(membersRes.members || []);
        setAuditLogs(auditRes);
      } catch (e: any) {
        message.error(e?.message || 'Failed to load tenant details');
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [open, workspace, message]);

  if (!workspace) return null;

  const ownerUser =
    members.find((m) => m.role === WorkspaceRole.OWNER) ||
    telemetry?.users.find((u) => u.role === 'OWNER' || u.role === WorkspaceRole.OWNER);

  const createdDateStr = workspace.createdAt
    ? new Date(workspace.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  const memberColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_: any, record: WorkspaceMemberResponse) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{record.name}</div>
          <div className="text-xs text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: WorkspaceRole) => {
        let color = 'default';
        if (role === WorkspaceRole.OWNER) color = 'gold';
        else if (role === WorkspaceRole.ADMIN) color = 'blue';
        else if (role === WorkspaceRole.MEMBER) color = 'green';
        return <Tag color={color}>{role}</Tag>;
      },
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => (date ? new Date(date).toLocaleDateString() : '-'),
    },
  ];

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <ApartmentOutlined className="text-blue-600" />
          <span>Tenant: {workspace.name}</span>
        </div>
      }
      placement="right"
      width={640}
      open={open}
      onClose={onClose}
    >
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Title level={4} className="!mb-0 text-gray-900 dark:text-white">
              {workspace.name}
            </Title>
          </div>
          <Badge
            status="processing"
            text={
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Created {createdDateStr}
              </span>
            }
          />
        </div>
      </div>

      <Spin spinning={isLoading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: 'Overview & Quota',
              children: (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Card size="small" className="text-center shadow-sm">
                      <DatabaseOutlined className="mb-1 text-xl text-blue-500" />
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {telemetry?.databasesCount ?? 0}
                      </div>
                      <div className="text-xs text-gray-500">Databases</div>
                    </Card>
                    <Card size="small" className="text-center shadow-sm">
                      <HistoryOutlined className="mb-1 text-xl text-emerald-500" />
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {telemetry?.backupsCount ?? 0}
                      </div>
                      <div className="text-xs text-gray-500">Backups</div>
                    </Card>
                    <Card size="small" className="text-center shadow-sm">
                      <HddOutlined className="mb-1 text-xl text-purple-500" />
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {telemetry?.storageConsumedMb
                          ? `${telemetry.storageConsumedMb.toFixed(1)} MB`
                          : '0 MB'}
                      </div>
                      <div className="text-xs text-gray-500">Storage Used</div>
                    </Card>
                  </div>

                  <Descriptions
                    title="Tenant Profile"
                    bordered
                    size="small"
                    column={1}
                    className="mt-4"
                  >
                    <Descriptions.Item label="Owner">
                      {ownerUser ? (
                        <Space direction="vertical" size={0}>
                          <Text strong>{ownerUser.name || ownerUser.email}</Text>
                          {ownerUser.name && (
                            <Text type="secondary" className="text-xs">
                              {ownerUser.email}
                            </Text>
                          )}
                        </Space>
                      ) : (
                        <Text type="secondary">Not assigned</Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Workspace ID">
                      <Text copyable className="text-xs">
                        {workspace.id}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Security Policy">
                      <Tag icon={<SafetyCertificateOutlined />} color="success">
                        Zero-Knowledge Encryption Active
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Members">
                      <Tag icon={<TeamOutlined />} color="blue">
                        {members.length || telemetry?.users.length || 0} Members
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ),
            },
            {
              key: 'members',
              label: `Members (${members.length})`,
              children: (
                <div>
                  <Table
                    columns={memberColumns}
                    dataSource={members}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: 'audit',
              label: 'Recent Audit Logs',
              children: (
                <div>
                  {auditLogs?.auditLogs && auditLogs.auditLogs.length > 0 ? (
                    <List
                      size="small"
                      dataSource={auditLogs.auditLogs}
                      renderItem={(log) => (
                        <List.Item className="!px-2">
                          <List.Item.Meta
                            avatar={<CheckCircleOutlined className="text-blue-500" />}
                            title={<span className="text-xs font-semibold">{log.message}</span>}
                            description={
                              <div className="text-[11px] text-gray-500">
                                <span>{log.userEmail || 'System'}</span> •{' '}
                                <span>{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty description="No recent audit logs recorded" />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Spin>
    </Drawer>
  );
}

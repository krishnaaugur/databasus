/* eslint-disable i18next/no-literal-string -- Tenant Dashboard UI */
import {
  ApartmentOutlined,
  BellOutlined,
  CodeOutlined,
  DatabaseOutlined,
  HddOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import { type Database, databaseApi } from '../../../entity/databases';
import type { UserProfile } from '../../../entity/users';
import {
  type WorkspaceResponse,
  type WorkspaceTelemetry,
  workspaceApi,
} from '../../../entity/workspaces';

const { Title, Text } = Typography;

interface Props {
  workspace: WorkspaceResponse;
  user?: UserProfile;
  contentHeight: number;
  onNavigateToTab: (tab: string) => void;
}

export function TenantDashboardComponent({
  workspace,
  user: _user,
  contentHeight,
  onNavigateToTab,
}: Props) {
  const [telemetry, setTelemetry] = useState<WorkspaceTelemetry | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [telemetryRes, databasesRes] = await Promise.all([
        workspaceApi.getWorkspaceTelemetry(workspace.id),
        databaseApi.getDatabases(workspace.id),
      ]);
      setTelemetry(telemetryRes);
      setDatabases(databasesRes || []);
    } catch {
      // Non-fatal error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [workspace.id]);

  const databaseColumns = [
    {
      title: 'Database Name',
      key: 'name',
      render: (_: any, record: Database) => (
        <div className="flex items-center gap-2">
          <DatabaseOutlined className="text-blue-500" />
          <div>
            <div className="font-medium text-gray-800 dark:text-gray-200">{record.name}</div>
            <div className="text-[11px] text-gray-500">ID: {record.id.slice(0, 8)}...</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        let color = 'geekblue';
        if (type.includes('POSTGRES')) color = 'blue';
        else if (type.includes('MONGO')) color = 'green';
        else if (type.includes('MYSQL') || type.includes('MARIADB')) color = 'orange';
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Connection Details',
      key: 'connection',
      render: (_: any, record: Database) => {
        const details =
          record.postgresqlLogical ||
          record.postgresqlPhysical ||
          record.mysql ||
          record.mariadb ||
          record.mongodb;
        if (!details) return <span className="text-xs text-gray-400">-</span>;
        const host = (details as any).host || 'localhost';
        const port = (details as any).port || '-';
        return (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {host}:{port}
          </span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <Button
          size="small"
          type="link"
          icon={<RightOutlined />}
          onClick={() => onNavigateToTab('databases')}
        >
          View Database
        </Button>
      ),
    },
  ];

  return (
    <div
      className="flex flex-col gap-5 overflow-y-auto rounded bg-white p-5 shadow dark:bg-gray-800"
      style={{ height: contentHeight }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <ApartmentOutlined className="text-lg text-blue-600" />
            <Title level={4} className="!mb-0 text-gray-900 dark:text-white">
              {workspace.name} Dashboard
            </Title>
            <Tag color="blue">{workspace.userRole}</Tag>
          </div>
          <Text type="secondary" className="text-xs">
            ID: {workspace.id} • Tenant workspace overview and backup activity.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDashboardData} loading={isLoading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => onNavigateToTab('databases')}
            className="border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
          >
            Add Database
          </Button>
        </Space>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="border-l-4 border-l-blue-500 shadow-sm">
            <Statistic
              title={<span className="text-xs font-semibold text-gray-500">DATABASES</span>}
              value={telemetry?.databasesCount ?? databases.length}
              prefix={<DatabaseOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="border-l-4 border-l-emerald-500 shadow-sm">
            <Statistic
              title={<span className="text-xs font-semibold text-gray-500">BACKUPS CREATED</span>}
              value={telemetry?.backupsCount ?? 0}
              prefix={<HistoryOutlined className="text-emerald-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="border-l-4 border-l-purple-500 shadow-sm">
            <Statistic
              title={<span className="text-xs font-semibold text-gray-500">STORAGE USED</span>}
              value={
                telemetry?.storageConsumedMb
                  ? `${telemetry.storageConsumedMb.toFixed(1)} MB`
                  : '0 MB'
              }
              prefix={<HddOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" className="border-l-4 border-l-orange-500 shadow-sm">
            <Statistic
              title={<span className="text-xs font-semibold text-gray-500">WORKSPACE MEMBERS</span>}
              value={telemetry?.users.length ?? 1}
              prefix={<TeamOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Access Shortcuts */}
      <div>
        <Title level={5} className="!mb-3 text-gray-800 dark:text-gray-200">
          Quick Actions & Configuration
        </Title>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card
            hoverable
            size="small"
            className="cursor-pointer text-center"
            onClick={() => onNavigateToTab('databases')}
          >
            <DatabaseOutlined className="mb-2 text-2xl text-blue-500" />
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Manage Databases
            </div>
            <div className="text-[11px] text-gray-400">View and configure databases</div>
          </Card>
          <Card
            hoverable
            size="small"
            className="cursor-pointer text-center"
            onClick={() => onNavigateToTab('storages')}
          >
            <HddOutlined className="mb-2 text-2xl text-purple-500" />
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Storage Backends
            </div>
            <div className="text-[11px] text-gray-400">S3, GCS, Local, WebDAV</div>
          </Card>
          <Card
            hoverable
            size="small"
            className="cursor-pointer text-center"
            onClick={() => onNavigateToTab('notifiers')}
          >
            <BellOutlined className="mb-2 text-2xl text-emerald-500" />
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Alert Notifiers
            </div>
            <div className="text-[11px] text-gray-400">Slack, Telegram, Discord</div>
          </Card>
          <Card
            hoverable
            size="small"
            className="cursor-pointer text-center"
            onClick={() => onNavigateToTab('api-docs')}
          >
            <CodeOutlined className="mb-2 text-2xl text-indigo-500" />
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              API & Automation
            </div>
            <div className="text-[11px] text-gray-400">API keys, cURL, integrations</div>
          </Card>
        </div>
      </div>

      {/* Connected Databases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Title level={5} className="!mb-0 text-gray-800 dark:text-gray-200">
            Connected Databases ({databases.length})
          </Title>
          {databases.length > 0 && (
            <Button
              type="link"
              size="small"
              icon={<RightOutlined />}
              onClick={() => onNavigateToTab('databases')}
            >
              Go to all databases
            </Button>
          )}
        </div>
        <Table
          columns={databaseColumns}
          dataSource={databases}
          rowKey="id"
          pagination={false}
          size="small"
          loading={isLoading}
        />
      </div>
    </div>
  );
}

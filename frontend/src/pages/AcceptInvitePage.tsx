/* eslint-disable i18next/no-literal-string -- Accept invitation interface */
import {
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LoadingOutlined,
} from '@ant-design/icons';
import { App, Button, Input, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { userApi } from '../entity/users';
import { AuthNavbarComponent } from '../features/users';
import { useScreenHeight } from '../shared/hooks';
import { translateApiError } from '../shared/i18n';

interface InvitationData {
  valid: boolean;
  email: string;
  name: string;
  workspaceId?: string;
  workspaceName?: string;
}

export function AcceptInvitePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const screenHeight = useScreenHeight();

  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided in URL.');
      setIsLoading(false);
      return;
    }

    userApi
      .validateInvitation(token)
      .then((data) => {
        setInvitationData(data);
        if (data.name && data.name !== 'User') {
          setName(data.name);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        setError(translateApiError(err, t) || 'This invitation is invalid or has expired.');
        setIsLoading(false);
      });
  }, [token, t]);

  const handleAccept = async () => {
    if (!password) {
      message.error('Please enter a password');
      return;
    }

    if (password.length < 8) {
      message.error('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      message.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await userApi.acceptInvitation({
        token,
        name: name.trim() || invitationData?.email.split('@')[0] || 'User',
        password,
      });

      message.success('Account created successfully! Welcome to Databasus.');
      navigate('/', { replace: true });
    } catch (err) {
      message.error(translateApiError(err, t) || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col dark:bg-gray-900" style={{ minHeight: screenHeight }}>
      <AuthNavbarComponent />

      <div className="mt-8 flex justify-center px-4 sm:mt-[10vh]">
        <div className="w-full max-w-[440px] rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spin indicator={<LoadingOutlined spin />} size="large" />
              <div className="mt-4 text-sm text-gray-500">Verifying invitation...</div>
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <div className="mb-2 text-xl font-bold text-red-600 dark:text-red-400">
                Invalid Invitation
              </div>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{error}</p>
              <Button type="primary" onClick={() => navigate('/', { replace: true })}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-6 text-center">
                <div className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
                  Accept Invitation
                </div>
                {invitationData?.workspaceName && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    You have been invited to join{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {invitationData.workspaceName}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Create your password below to activate your account.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Email address
                  </label>
                  <Input value={invitationData?.email || ''} disabled className="bg-gray-50" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Your Name
                  </label>
                  <Input
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Create Password
                  </label>
                  <Input.Password
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    visibilityToggle={{
                      visible: passwordVisible,
                      onVisibleChange: setPasswordVisible,
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Confirm Password
                  </label>
                  <Input.Password
                    placeholder="Re-type your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    onPressEnter={handleAccept}
                    iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  />
                </div>

                <Button
                  type="primary"
                  className="mt-6 w-full border-blue-600 bg-blue-600 hover:border-blue-700 hover:bg-blue-700"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  loading={isSubmitting}
                  onClick={handleAccept}
                >
                  Accept Invitation &amp; Set Password
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

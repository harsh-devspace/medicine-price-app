import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, Typography, Alert, Space } from 'antd';
import {
  MedicineBoxOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

const AuthView = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const { login, signup } = useAuth();
  const [loginForm] = Form.useForm();
  const [signupForm] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await login(values.email.trim(), values.password);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (values) => {
    if (values.password !== values.confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await signup(values.name.trim(), values.email.trim(), values.password);
      if (data?.session) {
        setSuccessMsg('Account created successfully! Redirecting...');
      } else {
        setSuccessMsg(
          'Account created! If confirmation is required, please verify your email before logging in.'
        );
        setActiveTab('login');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setErrorMsg(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 50%, #f8fafc 100%)',
        padding: '1.5rem',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
              color: '#ffffff',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              margin: '0 auto 0.75rem auto',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
            }}
          >
            <MedicineBoxOutlined />
          </div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
            Medicine Price Comparison
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
            Doctor's Supplier PTR & MRP Comparison Suite
          </Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            closable
            onClose={() => setErrorMsg(null)}
            style={{ marginBottom: '1.25rem', borderRadius: '8px' }}
          />
        )}

        {successMsg && (
          <Alert
            message={successMsg}
            type="success"
            showIcon
            closable
            onClose={() => setSuccessMsg(null)}
            style={{ marginBottom: '1.25rem', borderRadius: '8px' }}
          />
        )}

        {/* Tab Selection */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          centered
          items={[
            {
              key: 'login',
              label: <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Login</span>,
              children: (
                <Form
                  form={loginForm}
                  layout="vertical"
                  onFinish={handleLogin}
                  requiredMark={false}
                  style={{ marginTop: '0.5rem' }}
                >
                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' },
                    ]}
                  >
                    <Input
                      size="large"
                      prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="doctor@example.com"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[{ required: true, message: 'Please enter your password' }]}
                  >
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="Enter password"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading}
                    style={{
                      backgroundColor: '#0d9488',
                      borderColor: '#0d9488',
                      fontWeight: 600,
                      marginTop: '0.5rem',
                      height: '42px',
                    }}
                  >
                    Login to Account
                  </Button>

                  <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                      Don't have an account?{' '}
                      <a
                        style={{ color: '#0d9488', fontWeight: 600 }}
                        onClick={() => {
                          setActiveTab('signup');
                          setErrorMsg(null);
                        }}
                      >
                        Sign Up
                      </a>
                    </Text>
                  </div>
                </Form>
              ),
            },
            {
              key: 'signup',
              label: <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Create Account</span>,
              children: (
                <Form
                  form={signupForm}
                  layout="vertical"
                  onFinish={handleSignup}
                  requiredMark={false}
                  style={{ marginTop: '0.5rem' }}
                >
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, message: 'Please enter your name' }]}
                  >
                    <Input
                      size="large"
                      prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="Dr. John Doe"
                    />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' },
                    ]}
                  >
                    <Input
                      size="large"
                      prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="doctor@example.com"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: 'Please enter a password' },
                      { min: 6, message: 'Password must be at least 6 characters' },
                    ]}
                  >
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="At least 6 characters"
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    label="Confirm Password"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: 'Please confirm your password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Passwords do not match!'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="Repeat password"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading}
                    style={{
                      backgroundColor: '#0d9488',
                      borderColor: '#0d9488',
                      fontWeight: 600,
                      marginTop: '0.5rem',
                      height: '42px',
                    }}
                  >
                    Create Free Account
                  </Button>

                  <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                      Already have an account?{' '}
                      <a
                        style={{ color: '#0d9488', fontWeight: 600 }}
                        onClick={() => {
                          setActiveTab('login');
                          setErrorMsg(null);
                        }}
                      >
                        Login
                      </a>
                    </Text>
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AuthView;

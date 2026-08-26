import React, { useEffect, useState } from 'react';
import { Drawer, Tag, Typography, Spin, Table, Alert, Space } from 'antd';
import { TrophyFilled, ShopOutlined, BankOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

const QuickCompareDrawer = ({ open, onClose, selectedMedicine }) => {
  const [loading, setLoading] = useState(false);
  const [compareData, setCompareData] = useState(null);

  useEffect(() => {
    if (open && selectedMedicine) {
      fetchComparison();
    } else {
      setCompareData(null);
    }
  }, [open, selectedMedicine]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/medicines/quick-compare', {
        params: {
          product_name: selectedMedicine.product_name,
          contain: selectedMedicine.contain,
          id: selectedMedicine.id,
        },
      });
      if (res.data.success) {
        setCompareData(res.data);
      }
    } catch (err) {
      console.error('Error fetching quick compare:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Company',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 120,
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: '8px' }}>
          {text || 'Unknown'}
        </Tag>
      ),
    },
    {
      title: 'Agency / Supplier',
      dataIndex: 'agency',
      key: 'agency',
      width: 140,
      render: (text, record) => (
        <Space wrap>
          <ShopOutlined style={{ color: '#0d9488' }} />
          <Text strong>{text}</Text>
          {record.is_best_deal && (
            <Tag color="success" className="lowest-price-tag">
              <TrophyFilled /> Lowest PTR
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'PTR (₹)',
      dataIndex: 'ptr',
      key: 'ptr',
      width: 90,
      align: 'right',
      render: (val, record) => (
        <Text
          strong
          style={{
            color: record.is_best_deal ? '#15803d' : '#0f172a',
            fontSize: record.is_best_deal ? '1.05rem' : '0.95rem',
          }}
        >
          ₹{parseFloat(val).toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'MRP (₹)',
      dataIndex: 'mrp',
      key: 'mrp',
      width: 90,
      align: 'right',
      render: (val) => `₹${parseFloat(val).toFixed(2)}`,
    },
    {
      title: 'Price Diff vs Lowest',
      key: 'diff',
      width: 110,
      align: 'right',
      render: (_, record) => {
        if (record.is_best_deal) {
          return <Tag color="green">Best Price</Tag>;
        }
        return (
          <Text type="danger" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            +₹{record.price_diff_vs_lowest.toFixed(2)}
          </Text>
        );
      },
    },
  ];

  const drawerWidth = typeof window !== 'undefined' ? Math.min(650, window.innerWidth) : 650;

  return (
    <Drawer
      title={
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f766e', fontSize: '1.1rem' }}>
            Price Comparison
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
            {selectedMedicine?.product_name} {selectedMedicine?.company_name ? `(${selectedMedicine?.company_name})` : ''} • {selectedMedicine?.contain}
          </Text>
        </div>
      }
      placement="right"
      width={drawerWidth}
      onClose={onClose}
      open={open}
      styles={{ body: { padding: '1rem' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spin size="large" tip="Loading supplier prices..." />
        </div>
      ) : compareData && compareData.suppliers ? (
        <div>
          {compareData.suppliers.length > 1 && compareData.max_savings > 0 ? (
            <Alert
              message={
                <span style={{ fontSize: '0.85rem' }}>
                  <TrophyFilled style={{ color: '#15803d', marginRight: '6px' }} />
                  Buying from <strong>{compareData.suppliers[0].agency}</strong> saves up to{' '}
                  <strong>₹{compareData.max_savings.toFixed(2)}</strong> per unit!
                </span>
              }
              type="success"
              showIcon={false}
              style={{ marginBottom: '1rem', borderRadius: '8px' }}
            />
          ) : (
            <Alert
              message="Currently only 1 agency listed for this medicine."
              type="info"
              showIcon
              style={{ marginBottom: '1rem' }}
            />
          )}

          <Title level={5} style={{ marginBottom: '0.75rem', color: '#334155' }}>
            Dealer Price List ({compareData.suppliers.length} Entries)
          </Title>

          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={columns}
              dataSource={compareData.suppliers}
              rowKey="id"
              pagination={false}
              bordered
              scroll={{ x: 520 }}
              rowClassName={(record) => (record.is_best_deal ? 'lowest-price-row' : '')}
            />
          </div>
        </div>
      ) : (
        <Text type="secondary">No comparison data available.</Text>
      )}
    </Drawer>
  );
};

export default QuickCompareDrawer;

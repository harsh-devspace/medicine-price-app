import React, { useEffect, useState } from 'react';
import { Drawer, Card, Tag, Typography, Spin, Table, Alert, Space, Divider } from 'antd';
import { TrophyFilled, ShopOutlined, ArrowDownOutlined } from '@ant-design/icons';
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
      title: 'Agency / Supplier',
      dataIndex: 'agency',
      key: 'agency',
      render: (text, record) => (
        <Space>
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
      align: 'right',
      render: (val, record) => (
        <Text
          strong
          style={{
            color: record.is_best_deal ? '#15803d' : '#0f172a',
            fontSize: record.is_best_deal ? '1.1rem' : '0.95rem',
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
      align: 'right',
      render: (val) => `₹${parseFloat(val).toFixed(2)}`,
    },
    {
      title: 'Price Diff vs Lowest',
      key: 'diff',
      align: 'right',
      render: (_, record) => {
        if (record.is_best_deal) {
          return <Tag color="green">Best Price</Tag>;
        }
        return (
          <Text type="danger" style={{ fontWeight: 600 }}>
            +₹{record.price_diff_vs_lowest.toFixed(2)}
          </Text>
        );
      },
    },
  ];

  return (
    <Drawer
      title={
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f766e' }}>
            Price Comparison
          </Title>
          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
            {selectedMedicine?.product_name} ({selectedMedicine?.contain})
          </Text>
        </div>
      }
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      styles={{ body: { padding: '1.25rem' } }}
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
                <span>
                  <TrophyFilled style={{ color: '#15803d', marginRight: '6px' }} />
                  Buying from <strong>{compareData.suppliers[0].agency}</strong> saves up to{' '}
                  <strong>₹{compareData.max_savings.toFixed(2)}</strong> per unit!
                </span>
              }
              type="success"
              showIcon={false}
              style={{ marginBottom: '1.25rem', borderRadius: '8px' }}
            />
          ) : (
            <Alert
              message="Currently only 1 agency listed for this medicine."
              type="info"
              showIcon
              style={{ marginBottom: '1.25rem' }}
            />
          )}

          <Title level={5} style={{ marginBottom: '0.75rem', color: '#334155' }}>
            Dealer Price List ({compareData.suppliers.length} Agencies)
          </Title>

          <Table
            columns={columns}
            dataSource={compareData.suppliers}
            rowKey="id"
            pagination={false}
            bordered
            rowClassName={(record) => (record.is_best_deal ? 'lowest-price-row' : '')}
          />
        </div>
      ) : (
        <Text type="secondary">No comparison data available.</Text>
      )}
    </Drawer>
  );
};

export default QuickCompareDrawer;

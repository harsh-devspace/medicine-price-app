import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Typography, Input, Space } from 'antd';
import { SearchOutlined, TrophyFilled, ShopOutlined, BankOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const PriceComparisonView = ({ medicines, onQuickCompare }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Group medicines by normalized Product Name & Contain
  const groupedData = useMemo(() => {
    const map = new Map();

    medicines.forEach((med) => {
      const key = `${(med.product_name || '').trim().toLowerCase()}||${(med.contain || '').trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          product_name: med.product_name,
          contain: med.contain,
          company_name: med.company_name,
          items: [],
        });
      }
      map.get(key).items.push(med);
    });

    // Convert map to array and sort each group's items by PTR ascending
    const groups = Array.from(map.values()).map((group) => {
      const sortedItems = [...group.items].sort((a, b) => a.ptr - b.ptr);
      const minPtr = sortedItems.length > 0 ? sortedItems[0].ptr : 0;
      const maxPtr = sortedItems.length > 0 ? sortedItems[sortedItems.length - 1].ptr : 0;
      const maxSavings = maxPtr - minPtr;

      return {
        ...group,
        items: sortedItems.map((item) => ({
          ...item,
          is_lowest: Math.abs(item.ptr - minPtr) < 0.01 && sortedItems.length > 1,
        })),
        minPtr,
        maxPtr,
        maxSavings,
        supplierCount: sortedItems.length,
      };
    });

    return groups;
  }, [medicines]);

  // Filter groups by search term (including company name)
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groupedData;
    const term = searchTerm.toLowerCase();
    return groupedData.filter(
      (g) =>
        (g.product_name || '').toLowerCase().includes(term) ||
        (g.contain || '').toLowerCase().includes(term) ||
        (g.company_name || '').toLowerCase().includes(term) ||
        g.items.some(
          (i) =>
            (i.agency || '').toLowerCase().includes(term) ||
            (i.company_name || '').toLowerCase().includes(term)
        )
    );
  }, [groupedData, searchTerm]);

  return (
    <div>
      {/* Search Header Bar */}
      <Card style={{ marginBottom: '1.25rem', borderRadius: '12px' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Title level={4} style={{ margin: 0, color: '#0f766e' }}>
              Medicine Price Comparison Matrix
            </Title>
            <Text type="secondary">
              Comparing {groupedData.length} unique medicine formulas across suppliers
            </Text>
          </Col>
          <Col xs={24} sm={12}>
            <Input
              placeholder="Search product name, company, composition or supplier..."
              prefix={<SearchOutlined style={{ color: '#0d9488' }} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="large"
            />
          </Col>
        </Row>
      </Card>

      {/* Comparison Cards Grid */}
      <Row gutter={[16, 16]}>
        {filteredGroups.map((group) => (
          <Col xs={24} lg={12} key={group.key}>
            <Card
              bordered
              style={{
                borderRadius: '12px',
                borderColor: group.supplierCount > 1 ? '#86efac' : '#e2e8f0',
                background: '#ffffff',
              }}
              title={
                <div>
                  <Space align="baseline" wrap>
                    <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                      {group.product_name}
                    </Title>
                    {group.company_name && (
                      <Tag color="blue" style={{ fontSize: '0.75rem', borderRadius: '8px' }}>
                        {group.company_name}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                      ({group.contain})
                    </Text>
                  </Space>
                </div>
              }
              extra={
                group.supplierCount > 1 && group.maxSavings > 0 ? (
                  <Tag color="success" style={{ fontWeight: 600 }}>
                    Save up to ₹{group.maxSavings.toFixed(2)}/unit
                  </Tag>
                ) : (
                  <Tag color="blue">{group.supplierCount} Supplier</Tag>
                )
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`compare-card ${item.is_lowest ? 'cheapest' : ''}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Space wrap>
                        <ShopOutlined style={{ color: item.is_lowest ? '#15803d' : '#64748b' }} />
                        <Text strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                          {item.agency}
                        </Text>
                        {item.company_name && item.company_name !== group.company_name && (
                          <Tag color="default" style={{ fontSize: '0.75rem' }}>
                            {item.company_name}
                          </Tag>
                        )}
                        {item.is_lowest && (
                          <Tag color="success" className="lowest-price-tag">
                            <TrophyFilled /> Best Deal
                          </Tag>
                        )}
                      </Space>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <Text
                        strong
                        style={{
                          fontSize: '1.2rem',
                          color: item.is_lowest ? '#15803d' : '#0d9488',
                        }}
                      >
                        ₹{item.ptr.toFixed(2)}
                      </Text>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        MRP: ₹{item.mrp.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default PriceComparisonView;

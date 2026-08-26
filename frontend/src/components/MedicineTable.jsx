import React from 'react';
import { Table, Tag, Button, Space, Popconfirm, Tooltip, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, SwapOutlined, TrophyFilled } from '@ant-design/icons';

const { Text } = Typography;

const MedicineTable = ({ medicines, loading, onEdit, onDelete, onQuickCompare }) => {
  const columns = [
    {
      title: 'Sr. No.',
      dataIndex: 'sr_no',
      key: 'sr_no',
      width: 65,
      align: 'center',
      render: (_, __, index) => <Text type="secondary">{index + 1}</Text>,
    },
    {
      title: 'Company Name',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 150,
      sorter: (a, b) => (a.company_name || '').localeCompare(b.company_name || ''),
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: '10px', padding: '2px 8px', fontWeight: 600 }}>
          {text || 'Unknown'}
        </Tag>
      ),
    },
    {
      title: 'Product Name',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 170,
      sorter: (a, b) => a.product_name.localeCompare(b.product_name),
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text
            strong
            style={{ fontSize: '0.95rem', cursor: 'pointer', color: '#0f766e' }}
            onClick={() => onQuickCompare(record)}
          >
            {text}
          </Text>
          {record.is_lowest_ptr && (
            <Tag color="success" className="lowest-price-tag" style={{ margin: 0 }}>
              <TrophyFilled style={{ color: '#15803d' }} /> Lowest Price
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Contain (Composition)',
      dataIndex: 'contain',
      key: 'contain',
      width: 200,
      render: (text) => (
        <Text style={{ color: '#475569', fontStyle: 'italic', fontSize: '0.85rem' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'PTR (₹)',
      dataIndex: 'ptr',
      key: 'ptr',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.ptr - b.ptr,
      render: (val, record) => (
        <Text
          strong
          style={{
            color: record.is_lowest_ptr ? '#15803d' : '#0d9488',
            fontSize: '0.95rem',
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
      width: 110,
      align: 'right',
      sorter: (a, b) => a.mrp - b.mrp,
      render: (val) => <Text style={{ color: '#64748b', fontSize: '0.9rem' }}>₹{parseFloat(val).toFixed(2)}</Text>,
    },
    {
      title: 'Agency / Dealer',
      dataIndex: 'agency',
      key: 'agency',
      width: 150,
      render: (agency) => (
        <Tag color="cyan" style={{ borderRadius: '12px', padding: '2px 10px', fontWeight: 600 }}>
          {agency}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 130,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Compare side-by-side prices from all agencies">
            <Button
              type="text"
              icon={<SwapOutlined style={{ color: '#0284c7' }} />}
              onClick={() => onQuickCompare(record)}
            />
          </Tooltip>
          <Tooltip title="Edit medicine">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#0d9488' }} />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete medicine record">
            <Popconfirm
              title="Delete Medicine Record"
              description="Are you sure you want to delete this medicine price entry?"
              onConfirm={() => onDelete(record.id)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="table-responsive-wrapper">
      <Table
        columns={columns}
        dataSource={medicines}
        rowKey="id"
        loading={loading}
        scroll={{ x: 880 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100'],
          responsive: true,
        }}
        rowClassName={(record) => (record.is_lowest_ptr ? 'lowest-price-row' : '')}
        onRow={(record) => ({
          onDoubleClick: () => onQuickCompare(record),
        })}
        bordered={false}
        style={{ background: '#ffffff', borderRadius: '12px' }}
      />
    </div>
  );
};

export default MedicineTable;

import React from 'react';
import { Modal, Alert, Typography, Descriptions, Button, Space } from 'antd';
import { WarningFilled, EditOutlined, PlusOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const DuplicateWarningModal = ({ open, onCancel, onConfirmUpdate, duplicateInfo }) => {
  if (!duplicateInfo) return null;

  const { existingRecord, newValues } = duplicateInfo;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <Space style={{ color: '#d97706' }}>
          <WarningFilled style={{ fontSize: '1.4rem' }} />
          <Title level={4} style={{ margin: 0, color: '#b45309' }}>
            Duplicate Entry Detected
          </Title>
        </Space>
      }
      width={520}
    >
      <Alert
        type="warning"
        message={
          <span>
            An entry for <strong>{newValues.product_name}</strong> from agency{' '}
            <strong>{newValues.agency}</strong> already exists in your database.
          </span>
        }
        showIcon
        style={{ marginBottom: '1.25rem', marginTop: '0.75rem' }}
      />

      <Descriptions title="Price Comparison Breakdown" bordered size="small" column={1}>
        <Descriptions.Item label="Medicine">{newValues.product_name} ({newValues.contain})</Descriptions.Item>
        <Descriptions.Item label="Supplier">{newValues.agency}</Descriptions.Item>
        <Descriptions.Item label="Current Saved PTR">
          <Text delete style={{ color: '#64748b' }}>₹{existingRecord.ptr.toFixed(2)}</Text>
          <Text type="secondary"> (MRP: ₹{existingRecord.mrp.toFixed(2)})</Text>
        </Descriptions.Item>
        <Descriptions.Item label="New Proposed PTR">
          <Text strong style={{ color: '#0d9488', fontSize: '1.05rem' }}>
            ₹{parseFloat(newValues.ptr).toFixed(2)}
          </Text>
          <Text type="secondary"> (MRP: ₹{parseFloat(newValues.mrp).toFixed(2)})</Text>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={onConfirmUpdate}
            style={{ backgroundColor: '#0d9488', borderColor: '#0d9488' }}
          >
            Update Existing Price Record
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default DuplicateWarningModal;

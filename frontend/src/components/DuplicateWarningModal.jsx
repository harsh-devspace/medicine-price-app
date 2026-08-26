import React from 'react';
import { Modal, Alert, Typography, Descriptions, Button, Space } from 'antd';
import { WarningFilled, EditOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const DuplicateWarningModal = ({ open, onCancel, onConfirmUpdate, duplicateInfo }) => {
  if (!duplicateInfo) return null;

  const { existingRecord, newValues } = duplicateInfo;
  const modalWidth = typeof window !== 'undefined' ? Math.min(520, window.innerWidth - 24) : 520;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <Space style={{ color: '#d97706' }}>
          <WarningFilled style={{ fontSize: '1.25rem' }} />
          <Title level={4} style={{ margin: 0, color: '#b45309', fontSize: '1.05rem' }}>
            Duplicate Entry Detected
          </Title>
        </Space>
      }
      width={modalWidth}
      style={{ top: 20 }}
    >
      <Alert
        type="warning"
        message={
          <span style={{ fontSize: '0.85rem' }}>
            An entry for <strong>{newValues.product_name}</strong> from agency{' '}
            <strong>{newValues.agency}</strong> already exists in your database.
          </span>
        }
        showIcon
        style={{ marginBottom: '1rem', marginTop: '0.5rem' }}
      />

      <Descriptions title="Price Comparison Breakdown" bordered size="small" column={1}>
        <Descriptions.Item label="Company">{newValues.company_name || existingRecord.company_name || 'Unknown'}</Descriptions.Item>
        <Descriptions.Item label="Medicine">{newValues.product_name} ({newValues.contain})</Descriptions.Item>
        <Descriptions.Item label="Supplier">{newValues.agency}</Descriptions.Item>
        <Descriptions.Item label="Current Saved PTR">
          <Text delete style={{ color: '#64748b' }}>₹{parseFloat(existingRecord.ptr).toFixed(2)}</Text>
          <Text type="secondary"> (MRP: ₹{parseFloat(existingRecord.mrp).toFixed(2)})</Text>
        </Descriptions.Item>
        <Descriptions.Item label="New Proposed PTR">
          <Text strong style={{ color: '#0d9488', fontSize: '1rem' }}>
            ₹{parseFloat(newValues.ptr).toFixed(2)}
          </Text>
          <Text type="secondary"> (MRP: ₹{parseFloat(newValues.mrp).toFixed(2)})</Text>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
        <Space wrap>
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

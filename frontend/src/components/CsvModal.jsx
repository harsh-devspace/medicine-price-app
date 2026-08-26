import React, { useState } from 'react';
import { Modal, Upload, Button, Typography, Space, Card, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const CsvModal = ({ open, onClose, onRefresh }) => {
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { getAccessToken } = useAuth();

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = getAccessToken();
      const res = await axios.get('/api/export/csv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `medicine_prices_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Medicine price database exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      message.error('Failed to export CSV file.');
    } finally {
      setExporting(false);
    }
  };

  const customUploadRequest = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = getAccessToken();
      const res = await axios.post('/api/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.data.success) {
        message.success(res.data.message);
        onSuccess(res.data);
        onRefresh();
        onClose();
      } else {
        message.error(res.data.message || 'Import failed');
        onError(new Error(res.data.message));
      }
    } catch (err) {
      console.error('CSV import error:', err);
      message.error(err.response?.data?.message || 'Error uploading CSV file');
      onError(err);
    } finally {
      setUploading(false);
    }
  };

  const modalWidth = typeof window !== 'undefined' ? Math.min(540, window.innerWidth - 24) : 540;

  return (
    <Modal
      title={
        <Space style={{ color: '#0d9488' }}>
          <FileExcelOutlined style={{ fontSize: '1.25rem' }} />
          <Title level={4} style={{ margin: 0, color: '#0f766e', fontSize: '1.05rem' }}>
            CSV Import & Export Data Tools
          </Title>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={modalWidth}
      style={{ top: 20 }}
    >
      <Card style={{ marginBottom: '1rem', background: '#f8fafc' }}>
        <Title level={5} style={{ margin: 0, marginBottom: '0.5rem', color: '#1e293b' }}>
          Export Medicine Price Database
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          Download your personal medicine pricing dataset as a standard CSV spreadsheet file.
        </Text>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExportCsv}
          loading={exporting}
          style={{ backgroundColor: '#0d9488', borderColor: '#0d9488' }}
        >
          Download My Medicines CSV
        </Button>
      </Card>

      <Card style={{ background: '#ffffff' }}>
        <Title level={5} style={{ margin: 0, marginBottom: '0.5rem', color: '#1e293b' }}>
          Import Medicines from CSV
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          Upload a CSV file with columns: <code>Company Name, Product Name, Contain, PTR, MRP, Agency</code>. Existing records will be updated automatically!
        </Text>

        <Dragger
          name="file"
          accept=".csv"
          customRequest={customUploadRequest}
          showUploadList={false}
          disabled={uploading}
          style={{ padding: '1rem', background: '#fafafa', border: '2px dashed #cbd5e1' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#0d9488', fontSize: '2.5rem' }} />
          </p>
          <p className="ant-upload-text" style={{ fontWeight: 600, color: '#334155' }}>
            Click or drag CSV file to this area to import
          </p>
          <p className="ant-upload-hint" style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Supports CSV files. Duplicates will update saved PTR/MRP automatically.
          </p>
        </Dragger>
      </Card>
    </Modal>
  );
};

export default CsvModal;

import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Row, Col, Typography, Card } from 'antd';
import { MedicineBoxOutlined, DollarOutlined, ShopOutlined } from '@ant-design/icons';

const { Text } = Typography;

const AddEditMedicineModal = ({ open, onClose, onSubmit, medicine, loading, agencies }) => {
  const [form] = Form.useForm();
  const ptrValue = Form.useWatch('ptr', form);
  const mrpValue = Form.useWatch('mrp', form);

  useEffect(() => {
    if (medicine) {
      form.setFieldsValue({
        product_name: medicine.product_name,
        contain: medicine.contain,
        ptr: medicine.ptr,
        mrp: medicine.mrp,
        agency: medicine.agency,
      });
    } else {
      form.resetFields();
    }
  }, [medicine, open, form]);

  const handleFinish = (values) => {
    onSubmit(values);
  };

  const marginPct =
    ptrValue && mrpValue && mrpValue > 0
      ? (((mrpValue - ptrValue) / mrpValue) * 100).toFixed(1)
      : null;

  const modalWidth = typeof window !== 'undefined' ? Math.min(540, window.innerWidth - 24) : 540;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0d9488', fontSize: '1.05rem' }}>
          <MedicineBoxOutlined style={{ fontSize: '1.2rem' }} />
          <span>{medicine ? 'Edit Medicine Price Entry' : 'Add New Medicine Record'}</span>
        </div>
      }
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={medicine ? 'Update Entry' : 'Save Medicine'}
      destroyOnClose
      width={modalWidth}
      style={{ top: 20 }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ ptr: 10, mrp: 20 }}
        style={{ marginTop: '0.75rem' }}
      >
        <Form.Item
          name="product_name"
          label="Product Name"
          rules={[{ required: true, message: 'Please enter product name (e.g. Dolo 650)' }]}
        >
          <Input placeholder="e.g. Dolo 650" prefix={<MedicineBoxOutlined style={{ color: '#64748b' }} />} />
        </Form.Item>

        <Form.Item
          name="contain"
          label="Contain (Composition)"
          rules={[{ required: true, message: 'Please enter composition (e.g. Paracetamol 650 mg)' }]}
        >
          <Input placeholder="e.g. Paracetamol 650 mg" />
        </Form.Item>

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="ptr"
              label="PTR (Purchase Price ₹)"
              rules={[{ required: true, message: 'Please enter PTR' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                step={0.5}
                prefix="₹"
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="mrp"
              label="MRP (Max Retail Price ₹)"
              rules={[{ required: true, message: 'Please enter MRP' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                step={0.5}
                prefix="₹"
                style={{ width: '100%' }}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
        </Row>

        {marginPct !== null && (
          <Card size="small" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: '1rem' }}>
            <Row justify="space-between" align="middle">
              <Text type="secondary" style={{ fontSize: '0.85rem' }}>Estimated Profit Margin:</Text>
              <Text strong style={{ color: marginPct >= 0 ? '#15803d' : '#dc2626', fontSize: '0.95rem' }}>
                {marginPct}% (₹{(mrpValue - ptrValue).toFixed(2)} gain/unit)
              </Text>
            </Row>
          </Card>
        )}

        <Form.Item
          name="agency"
          label="Agency / Dealer / MR Name"
          rules={[{ required: true, message: 'Please specify supplier/agency name' }]}
        >
          <Select
            showSearch
            allowClear
            placeholder="Select existing agency or type a new one"
            prefix={<ShopOutlined />}
            options={agencies.map((a) => ({ value: a, label: a }))}
            dropdownRender={(menu) => (
              <>
                {menu}
              </>
            )}
            onSearch={(val) => {
              if (val && !agencies.includes(val)) {
                form.setFieldValue('agency', val);
              }
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddEditMedicineModal;

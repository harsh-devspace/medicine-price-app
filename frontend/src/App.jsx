import React, { useEffect, useState, useCallback } from 'react';
import {
  Layout,
  Tabs,
  Input,
  Button,
  Select,
  Drawer,
  Slider,
  Row,
  Col,
  Space,
  Badge,
  Typography,
  message,
  Card,
  Tooltip,
  Divider,
  Spin,
  Popconfirm,
  Avatar,
} from 'antd';
import {
  MedicineBoxOutlined,
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  SwapOutlined,
  FileExcelOutlined,
  ShopOutlined,
  TrophyOutlined,
  UndoOutlined,
  BankOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import axios from 'axios';

import { useAuth } from './context/AuthContext';
import AuthView from './components/AuthView';
import MedicineTable from './components/MedicineTable';
import QuickCompareDrawer from './components/QuickCompareDrawer';
import PriceComparisonView from './components/PriceComparisonView';
import AddEditMedicineModal from './components/AddEditMedicineModal';
import DuplicateWarningModal from './components/DuplicateWarningModal';
import CsvModal from './components/CsvModal';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const App = () => {
  const { user, loading: authLoading, logout } = useAuth();

  const [medicines, setMedicines] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({
    totalMedicines: 0,
    totalAgencies: 0,
    uniqueProducts: 0,
    totalCompanies: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('directory');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [ptrRange, setPtrRange] = useState([0, 500]);
  const [mrpRange, setMrpRange] = useState([0, 1000]);
  const [sortBy, setSortBy] = useState('product_name');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Modals & Drawers State
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [quickCompareOpen, setQuickCompareOpen] = useState(false);
  const [selectedCompareMed, setSelectedCompareMed] = useState(null);
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch medicines with current filters
  const fetchMedicines = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = {
        q: searchQuery,
        agency: selectedAgency || undefined,
        company: selectedCompany || undefined,
        minPtr: ptrRange[0] > 0 ? ptrRange[0] : undefined,
        maxPtr: ptrRange[1] < 500 ? ptrRange[1] : undefined,
        minMrp: mrpRange[0] > 0 ? mrpRange[0] : undefined,
        maxMrp: mrpRange[1] < 1000 ? mrpRange[1] : undefined,
        sortBy: sortBy,
      };

      const res = await axios.get('/api/medicines', { params });
      if (res.data.success) {
        setMedicines(res.data.data);
      }
    } catch (err) {
      console.error('Error loading medicines:', err);
      if (err.response?.status === 401) {
        message.warning('Session expired. Please log in again.');
      } else {
        message.error('Failed to connect to backend server');
      }
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery, selectedAgency, selectedCompany, ptrRange, mrpRange, sortBy]);

  // Fetch agencies list
  const fetchAgencies = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/agencies');
      if (res.data.success) {
        setAgencies(res.data.agencies);
      }
    } catch (err) {
      console.error('Error loading agencies:', err);
    }
  }, [user]);

  // Fetch companies list
  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/companies');
      if (res.data.success) {
        setCompanies(res.data.companies);
      }
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  }, [user]);

  // Fetch stats overview
  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/dashboard/stats');
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [user]);

  const refreshAllData = useCallback(() => {
    fetchMedicines();
    fetchAgencies();
    fetchCompanies();
    fetchStats();
  }, [fetchMedicines, fetchAgencies, fetchCompanies, fetchStats]);

  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Handle Add or Submit Form (with Duplicate Check)
  const handleSaveMedicine = async (values, forceUpdate = false) => {
    setFormSubmitting(true);
    try {
      if (editingMedicine) {
        // Edit mode
        const res = await axios.put(`/api/medicines/${editingMedicine.id}`, values);
        if (res.data.success) {
          message.success('Medicine record updated successfully');
          setAddEditOpen(false);
          setEditingMedicine(null);
          refreshAllData();
        }
      } else {
        // Add mode (with duplicate check)
        const payload = { ...values, force_update: forceUpdate };
        const res = await axios.post('/api/medicines', payload);

        if (res.data.success) {
          if (res.data.isDuplicate) {
            // Duplicate detected!
            setDuplicateInfo({
              existingRecord: res.data.existingRecord,
              newValues: values,
            });
            setDuplicateWarningOpen(true);
          } else {
            message.success(
              res.data.action === 'updated'
                ? 'Existing record updated with new PTR/MRP'
                : 'New medicine added successfully'
            );
            setAddEditOpen(false);
            setDuplicateWarningOpen(false);
            setDuplicateInfo(null);
            refreshAllData();
          }
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      message.error(err.response?.data?.message || 'Error saving record');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm duplicate update
  const handleConfirmDuplicateUpdate = () => {
    if (duplicateInfo && duplicateInfo.newValues) {
      handleSaveMedicine(duplicateInfo.newValues, true);
    }
  };

  // Delete Record
  const handleDeleteMedicine = async (id) => {
    try {
      const res = await axios.delete(`/api/medicines/${id}`);
      if (res.data.success) {
        message.success('Medicine record deleted');
        refreshAllData();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete record');
    }
  };

  // Open Quick Compare
  const handleOpenQuickCompare = (record) => {
    setSelectedCompareMed(record);
    setQuickCompareOpen(true);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAgency(null);
    setSelectedCompany(null);
    setPtrRange([0, 500]);
    setMrpRange([0, 1000]);
    setSortBy('product_name');
    setFilterDrawerOpen(false);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedAgency ||
    selectedCompany ||
    ptrRange[0] > 0 ||
    ptrRange[1] < 500 ||
    mrpRange[0] > 0 ||
    mrpRange[1] < 1000;

  // 1. Loading screen while authenticating
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          background: '#f8fafc',
        }}
      >
        <Spin size="large" />
        <Text type="secondary">Loading Medicine Price App...</Text>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Login/Signup Page
  if (!user) {
    return <AuthView />;
  }

  // User Display Name
  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Doctor';

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <MedicineBoxOutlined />
          </div>
          <div>
            <h1 className="brand-title">Medicine Price Comparison</h1>
            <div className="brand-subtitle">Doctor's Supplier PTR & MRP Comparison Suite</div>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-pill">
            <span>Total Medicines:</span>
            <strong>{stats.totalMedicines}</strong>
          </div>
          <div className="stat-pill">
            <BankOutlined style={{ color: '#0284c7' }} />
            <span>Companies:</span>
            <strong>{stats.totalCompanies}</strong>
          </div>
          <div className="stat-pill">
            <ShopOutlined style={{ color: '#0d9488' }} />
            <span>Agencies:</span>
            <strong>{stats.totalAgencies}</strong>
          </div>
          <div className="stat-pill">
            <TrophyOutlined style={{ color: '#15803d' }} />
            <span>Formulas:</span>
            <strong>{stats.uniqueProducts}</strong>
          </div>

          {/* User Profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <Tooltip title={`Signed in as ${user.email}`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <Avatar size={20} style={{ backgroundColor: '#0d9488' }} icon={<UserOutlined />} />
                <span>{userName}</span>
              </div>
            </Tooltip>

            <Popconfirm
              title="Logout"
              description="Are you sure you want to log out?"
              onConfirm={logout}
              okText="Yes, Logout"
              cancelText="Cancel"
            >
              <Button
                type="text"
                danger
                icon={<LogoutOutlined />}
                size="small"
                style={{ borderRadius: '6px' }}
              >
                Logout
              </Button>
            </Popconfirm>
          </div>
        </div>
      </header>

      {/* Main Layout Content */}
      <main className="main-content">
        {/* Navigation Tabs Header */}
        <div className="tab-actions-header">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ marginBottom: 0 }}
            items={[
              {
                key: 'directory',
                label: (
                  <Space size={4}>
                    <MedicineBoxOutlined />
                    <span>Price Directory</span>
                    <Badge
                      count={medicines.length}
                      overflowCount={999}
                      style={{ backgroundColor: '#0d9488' }}
                    />
                  </Space>
                ),
              },
              {
                key: 'compare',
                label: (
                  <Space size={4}>
                    <SwapOutlined />
                    <span>Compare Matrix</span>
                  </Space>
                ),
              },
            ]}
          />

          <div className="tab-actions-buttons">
            <Button
              className="py-3 sm:py-1.5"
              icon={<FileExcelOutlined style={{ color: '#16a34a' }} />}
              onClick={() => setCsvModalOpen(true)}
            >
              CSV Tools
            </Button>
            <Button
              type="primary"
              className="py-3 sm:py-1.5"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingMedicine(null);
                setAddEditOpen(true);
              }}
              style={{ backgroundColor: '#0d9488', borderColor: '#0d9488', fontWeight: 600 }}
            >
              + Add Medicine
            </Button>
          </div>
        </div>

        {/* Tab 1: Medicine Directory */}
        {activeTab === 'directory' && (
          <div>
            {/* Control Toolbar */}
            <div className="toolbar-card">
              <div className="toolbar-left">
                <Input
                  placeholder="Search Product Name, Company, Composition, or Agency..."
                  prefix={<SearchOutlined style={{ color: '#0d9488' }} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                  style={{ width: '100%' }}
                />
              </div>

              <div className="toolbar-right">
                <Select
                  placeholder="Filter Company"
                  allowClear
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  style={{ minWidth: 140 }}
                  options={companies.map((c) => ({ value: c, label: c }))}
                />

                <Select
                  placeholder="Filter Agency"
                  allowClear
                  value={selectedAgency}
                  onChange={setSelectedAgency}
                  style={{ minWidth: 140 }}
                  options={agencies.map((a) => ({ value: a, label: a }))}
                />

                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  style={{ minWidth: 160 }}
                  options={[
                    { value: 'product_name', label: 'Name (A to Z)' },
                    { value: 'product_name_desc', label: 'Name (Z to A)' },
                    { value: 'company_name_asc', label: 'Company (A to Z)' },
                    { value: 'company_name_desc', label: 'Company (Z to A)' },
                    { value: 'ptr_asc', label: 'PTR: Low to High' },
                    { value: 'ptr_desc', label: 'PTR: High to Low' },
                    { value: 'mrp_asc', label: 'MRP: Low to High' },
                    { value: 'mrp_desc', label: 'MRP: High to Low' },
                  ]}
                />

                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setFilterDrawerOpen(true)}
                  type={hasActiveFilters ? 'primary' : 'default'}
                  ghost={hasActiveFilters}
                >
                  Filters {hasActiveFilters && '•'}
                </Button>

                {hasActiveFilters && (
                  <Button icon={<UndoOutlined />} onClick={handleResetFilters} type="text">
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Table Component */}
            <MedicineTable
              medicines={medicines}
              loading={loading}
              onEdit={(med) => {
                setEditingMedicine(med);
                setAddEditOpen(true);
              }}
              onDelete={handleDeleteMedicine}
              onQuickCompare={handleOpenQuickCompare}
            />
          </div>
        )}

        {/* Tab 2: Full Price Comparison Matrix */}
        {activeTab === 'compare' && (
          <PriceComparisonView medicines={medicines} onQuickCompare={handleOpenQuickCompare} />
        )}
      </main>

      {/* Filter Drawer */}
      <Drawer
        title="Advanced Price & Medicine Filters"
        placement="right"
        onClose={() => setFilterDrawerOpen(false)}
        open={filterDrawerOpen}
        width={Math.min(360, typeof window !== 'undefined' ? window.innerWidth : 360)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>PTR Range (₹):</Text>
            <Row gutter={16} style={{ marginTop: '8px' }}>
              <Col span={12}>Min: ₹{ptrRange[0]}</Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                Max: ₹{ptrRange[1] === 500 ? '500+' : ptrRange[1]}
              </Col>
            </Row>
            <Slider
              range
              min={0}
              max={500}
              step={5}
              value={ptrRange}
              onChange={setPtrRange}
            />
          </div>

          <div>
            <Text strong>MRP Range (₹):</Text>
            <Row gutter={16} style={{ marginTop: '8px' }}>
              <Col span={12}>Min: ₹{mrpRange[0]}</Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                Max: ₹{mrpRange[1] === 1000 ? '1000+' : mrpRange[1]}
              </Col>
            </Row>
            <Slider
              range
              min={0}
              max={1000}
              step={10}
              value={mrpRange}
              onChange={setMrpRange}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Company / Manufacturer:
            </Text>
            <Select
              placeholder="Select Company"
              allowClear
              value={selectedCompany}
              onChange={setSelectedCompany}
              style={{ width: '100%' }}
              options={companies.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>
              Supplier / Agency:
            </Text>
            <Select
              placeholder="Select Agency"
              allowClear
              value={selectedAgency}
              onChange={setSelectedAgency}
              style={{ width: '100%' }}
              options={agencies.map((a) => ({ value: a, label: a }))}
            />
          </div>

          <Divider />

          <Button type="primary" block onClick={() => setFilterDrawerOpen(false)}>
            Apply Filters
          </Button>
          <Button block onClick={handleResetFilters}>
            Reset All Filters
          </Button>
        </Space>
      </Drawer>

      {/* Modals and Drawers */}
      <QuickCompareDrawer
        open={quickCompareOpen}
        onClose={() => setQuickCompareOpen(false)}
        selectedMedicine={selectedCompareMed}
      />

      <AddEditMedicineModal
        open={addEditOpen}
        onClose={() => {
          setAddEditOpen(false);
          setEditingMedicine(null);
        }}
        onSubmit={handleSaveMedicine}
        medicine={editingMedicine}
        loading={formSubmitting}
        agencies={agencies}
        companies={companies}
      />

      <DuplicateWarningModal
        open={duplicateWarningOpen}
        onCancel={() => {
          setDuplicateWarningOpen(false);
          setDuplicateInfo(null);
        }}
        onConfirmUpdate={handleConfirmDuplicateUpdate}
        duplicateInfo={duplicateInfo}
      />

      <CsvModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onRefresh={refreshAllData}
      />

      {/* Footer */}
      <footer className="app-footer">
        Medicine Price Comparison System for Doctors • Multi-User Cloud Suite • Supabase & PostgreSQL
      </footer>
    </div>
  );
};

export default App;

// =============================================================================
// LOYALTY PAGE - Comprehensive Loyalty Program Management
// =============================================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerStore } from '../stores/customerStore';
import { useLoyaltyStore, DEFAULT_TIERS } from '../stores/loyaltyStore';
import type { MembershipTier } from '../stores/loyaltyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useProductStore } from '../stores/productStore';
import { formatVND } from '@/lib/cashReconciliation';
import { cn } from '../lib/utils';
import { CustomerDetailsView } from '@/components/customers/CustomerDetailsView';
import type { Customer } from '@/types';

// ============================================================================
// TAB TYPES
// ============================================================================

type TabId = 'overview' | 'members' | 'points' | 'tiers' | 'activity' | 'config';

interface Tab {
    id: TabId;
    label: string;
    icon: string;
}

const TABS: Tab[] = [
    { id: 'overview', label: 'Tổng quan', icon: '📊' },
    { id: 'members', label: 'Khách hàng thành viên', icon: '👥' },
    { id: 'points', label: 'Tích điểm', icon: '🎯' },
    { id: 'tiers', label: 'Hạng thành viên', icon: '🏆' },
    { id: 'activity', label: 'Hoạt động', icon: '📋' },
    { id: 'config', label: 'Cấu hình', icon: '⚙️' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LoyaltyPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-100">
            {/* Sidebar - Green Theme (Desktop) */}
            <div className="hidden md:flex w-56 bg-gradient-to-b from-green-700 to-green-800 text-white flex-col shadow-xl">
                {/* Header with Back Button */}
                <div className="p-4 border-b border-green-600">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-green-200 hover:text-white transition-colors mb-3 text-sm"
                    >
                        <span>←</span>
                        <span>Quay lại</span>
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span>⭐</span>
                        <span>Loyalty</span>
                    </h1>
                </div>
                <nav className="flex-1 py-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full px-4 py-3 text-left flex items-center gap-3 transition-colors text-sm",
                                activeTab === tab.id
                                    ? "bg-white/20 text-white border-l-4 border-white"
                                    : "text-green-100 hover:bg-white/10 hover:text-white border-l-4 border-transparent"
                            )}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 overflow-auto bg-slate-100 flex flex-col">
                {/* Mobile Header & Tabs */}
                <div className="md:hidden bg-gradient-to-r from-green-700 to-green-800 text-white shadow-md sticky top-0 z-10">
                    <div className="p-4 flex items-center justify-between border-b border-green-600">
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <span>⭐</span>
                            <span>Loyalty Program</span>
                        </h1>
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    {/* Mobile Horizontal Tabs */}
                    <div className="flex overflow-x-auto hide-scrollbar">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-white text-white bg-white/10"
                                        : "border-transparent text-green-100 hover:text-white"
                                )}
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 md:p-6">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6 hidden md:block">
                        {TABS.find(t => t.id === activeTab)?.label}
                    </h2>

                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'members' && <MembersTab />}
                    {activeTab === 'points' && <PointsTab />}
                    {activeTab === 'tiers' && <TiersTab />}
                    {activeTab === 'activity' && <ActivityTab />}
                    {activeTab === 'config' && <ConfigTab />}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// OVERVIEW TAB - Dashboard with Stats and Charts
// ============================================================================

function OverviewTab() {
    const { customers } = useCustomerStore();
    const { getStats, getDailyStats, transactions } = useLoyaltyStore();
    const [period, setPeriod] = useState(7);

    const stats = useMemo(() => getStats(period), [getStats, period, transactions]);
    const dailyStats = useMemo(() => getDailyStats(period), [getDailyStats, period, transactions]);

    // Calculate totals from customers
    const totalMembers = customers.filter(c => c.is_active).length;
    const totalPointsBalance = customers.reduce((sum, c) => sum + (c.points_balance || 0), 0);
    const totalSpent = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

    // Top customers by points
    const topCustomers = useMemo(() => {
        return [...customers]
            .filter(c => c.points_balance > 0)
            .sort((a, b) => b.points_balance - a.points_balance)
            .slice(0, 5);
    }, [customers]);

    // Top customers by spending
    const topSpenders = useMemo(() => {
        return [...customers]
            .filter(c => c.total_spent > 0)
            .sort((a, b) => b.total_spent - a.total_spent)
            .slice(0, 5);
    }, [customers]);

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Thời gian:</span>
                <select
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                >
                    <option value={7}>7 ngày qua</option>
                    <option value={14}>14 ngày qua</option>
                    <option value={30}>30 ngày qua</option>
                </select>
            </div>

            {/* Stats Cards */}
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">TOÀN THỜI GIAN</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon="👥"
                    label="Thành viên"
                    value={totalMembers.toLocaleString()}
                    color="blue"
                />
                <StatCard
                    icon="🎯"
                    label="Điểm hiện có"
                    value={totalPointsBalance.toLocaleString()}
                    color="green"
                />
                <StatCard
                    icon="💰"
                    label="Tổng chi tiêu"
                    value={formatVND(totalSpent)}
                    color="orange"
                />
                <StatCard
                    icon="📈"
                    label="Đổi thưởng"
                    value={`${stats.redemptionRate.toFixed(0)}%`}
                    color="purple"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* New Members Chart */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="mb-4">
                        <h3 className="font-bold text-slate-800">THÀNH VIÊN MỚI</h3>
                        <p className="text-2xl font-bold text-orange-500">{stats.newMembersToday}</p>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">Thành viên theo thời gian</div>
                    <SimpleLineChart
                        data={dailyStats.map(d => d.newMembers)}
                        labels={dailyStats.map(d => d.date)}
                        color="#f59e0b"
                    />
                </div>

                {/* Points Chart */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="mb-4 flex gap-8">
                        <div>
                            <h3 className="font-bold text-slate-800">ĐIỂM KIẾM ĐƯỢC</h3>
                            <p className="text-2xl font-bold text-green-500">{stats.totalPointsIssued.toLocaleString()}</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">ĐIỂM CHI TIÊU</h3>
                            <p className="text-2xl font-bold text-red-500">{stats.totalPointsRedeemed.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">Điểm theo thời gian</div>
                    <DualLineChart
                        data1={dailyStats.map(d => d.pointsEarned)}
                        data2={dailyStats.map(d => d.pointsRedeemed)}
                        labels={dailyStats.map(d => d.date)}
                        color1="#22c55e"
                        color2="#ef4444"
                        label1="Điểm kiếm được"
                        label2="Điểm chi tiêu"
                    />
                </div>
            </div>

            {/* Top Customers Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top by Points */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">TOP KHÁCH HÀNG ĐẠT ĐIỂM CAO NHẤT</h3>
                        <select className="text-sm border rounded px-2 py-1">
                            <option>Top 5</option>
                        </select>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b">
                                <th className="text-left py-2">Họ tên</th>
                                <th className="text-right py-2">Số điểm</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topCustomers.map((c) => (
                                <tr key={c.id} className="border-b border-slate-100">
                                    <td className="py-2 text-blue-600">{c.name}</td>
                                    <td className="py-2 text-right font-medium">{c.points_balance.toLocaleString()}</td>
                                </tr>
                            ))}
                            {topCustomers.length === 0 && (
                                <tr><td colSpan={2} className="py-4 text-center text-slate-400">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Top by Spending */}
                <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">TOP KHÁCH HÀNG CHI TIÊU NHIỀU NHẤT</h3>
                        <select className="text-sm border rounded px-2 py-1">
                            <option>Top 5</option>
                        </select>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b">
                                <th className="text-left py-2">Họ tên</th>
                                <th className="text-right py-2">Chi tiêu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topSpenders.map((c) => (
                                <tr key={c.id} className="border-b border-slate-100">
                                    <td className="py-2 text-blue-600">{c.name}</td>
                                    <td className="py-2 text-right font-medium">{formatVND(c.total_spent)}</td>
                                </tr>
                            ))}
                            {topSpenders.length === 0 && (
                                <tr><td colSpan={2} className="py-4 text-center text-slate-400">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        orange: 'bg-orange-50 text-orange-600',
        purple: 'bg-purple-50 text-purple-600',
    }[color] || 'bg-slate-50 text-slate-600';

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", colorClasses)}>
                <span className="text-xl">{icon}</span>
            </div>
            <div>
                <div className="text-xs text-slate-500">{label}</div>
                <div className={cn("text-xl font-bold", colorClasses.split(' ')[1])}>{value}</div>
            </div>
        </div>
    );
}

// Simple Line Chart (SVG)
function SimpleLineChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
    const max = Math.max(...data, 1);
    const height = 120;
    const width = 400;
    const padding = 20;

    const points = data.map((v, i) => ({
        x: padding + (i / (data.length - 1 || 1)) * (width - 2 * padding),
        y: height - padding - (v / max) * (height - 2 * padding),
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
            <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
            ))}
            {/* X-axis labels */}
            {labels.map((label, i) => (
                <text
                    key={i}
                    x={points[i]?.x || 0}
                    y={height - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#94a3b8"
                >
                    {i === 0 || i === labels.length - 1 ? label : ''}
                </text>
            ))}
        </svg>
    );
}

// Dual Line Chart
function DualLineChart({ data1, data2, labels, color1, color2, label1, label2 }: {
    data1: number[]; data2: number[]; labels: string[]; color1: string; color2: string; label1: string; label2: string;
}) {
    const max = Math.max(...data1, ...data2, 1);
    const height = 120;
    const width = 400;
    const padding = 20;

    const getPoints = (data: number[]) => data.map((v, i) => ({
        x: padding + (i / (data.length - 1 || 1)) * (width - 2 * padding),
        y: height - padding - (v / max) * (height - 2 * padding),
    }));

    const points1 = getPoints(data1);
    const points2 = getPoints(data2);

    const pathD1 = points1.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const pathD2 = points2.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
                <path d={pathD1} fill="none" stroke={color1} strokeWidth="2" />
                <path d={pathD2} fill="none" stroke={color2} strokeWidth="2" />
            </svg>
            <div className="flex gap-4 text-xs mt-2">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5" style={{ backgroundColor: color1 }}></span>
                    {label1}
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5" style={{ backgroundColor: color2 }}></span>
                    {label2}
                </span>
            </div>
        </div>
    );
}

// ============================================================================
// MEMBERS TAB - Customer List with Tier Info
// ============================================================================

function MembersTab() {
    const { customers } = useCustomerStore();
    const { getTierForSpent } = useLoyaltyStore();
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState<string>('all');

    const filteredCustomers = useMemo(() => {
        return customers
            .filter(c => c.is_active)
            .filter(c => {
                if (search) {
                    const q = search.toLowerCase();
                    return c.name.toLowerCase().includes(q) || c.phone?.includes(q);
                }
                return true;
            })
            .filter(c => {
                if (tierFilter === 'all') return true;
                const tier = getTierForSpent(c.total_spent || 0);
                return tier.id === tierFilter;
            })
            .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
    }, [customers, search, tierFilter, getTierForSpent]);

    return (
        <div className="bg-white rounded-xl shadow-sm border">
            {/* Filters */}
            <div className="p-4 border-b flex gap-4">
                <input
                    type="text"
                    placeholder="Tìm theo tên hoặc SĐT..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="all">Tất cả hạng</option>
                    {DEFAULT_TIERS.map(t => (
                        <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="md:hidden p-4 space-y-4">
                {filteredCustomers.map((c) => {
                    const tier = getTierForSpent(c.total_spent || 0);
                    return (
                        <div key={c.id} className="bg-slate-50 border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-800">{c.name}</div>
                                    <div className="text-sm text-slate-500">{c.phone || 'No phone'}</div>
                                </div>
                                <span
                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: tier.color + '20', color: tier.color }}
                                >
                                    {tier.icon} {tier.name}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t pt-2 border-slate-200">
                                <div>
                                    <span className="text-slate-500">Điểm: </span>
                                    <span className="font-bold text-green-600">{c.points_balance.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Chi tiêu: </span>
                                    <span className="font-medium">{formatVND(c.total_spent || 0)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredCustomers.length === 0 && (
                    <div className="text-center text-slate-400 py-4">Không tìm thấy khách hàng</div>
                )}
            </div>

            <table className="hidden md:table w-full text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="text-left p-3">Khách hàng</th>
                        <th className="text-left p-3">SĐT</th>
                        <th className="text-right p-3">Điểm</th>
                        <th className="text-right p-3">Chi tiêu</th>
                        <th className="text-center p-3">Hạng</th>
                        <th className="text-center p-3">Đơn hàng</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredCustomers.map((c) => {
                        const tier = getTierForSpent(c.total_spent || 0);
                        return (
                            <tr key={c.id} className="border-b hover:bg-slate-50">
                                <td className="p-3 font-medium">{c.name}</td>
                                <td className="p-3 text-slate-600">{c.phone || '-'}</td>
                                <td className="p-3 text-right font-medium text-green-600">{c.points_balance.toLocaleString()}</td>
                                <td className="p-3 text-right">{formatVND(c.total_spent || 0)}</td>
                                <td className="p-3 text-center">
                                    <span
                                        className="px-2 py-1 rounded-full text-xs font-medium"
                                        style={{ backgroundColor: tier.color + '20', color: tier.color }}
                                    >
                                        {tier.icon} {tier.name}
                                    </span>
                                </td>
                                <td className="p-3 text-center">{c.total_orders || 0}</td>
                            </tr>
                        );
                    })}
                    {filteredCustomers.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                                Không tìm thấy khách hàng
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// POINTS TAB - Manual Point Adjustment
// ============================================================================

function PointsTab() {
    const { customers, updateCustomer } = useCustomerStore();
    const { adjustPoints } = useLoyaltyStore();
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [points, setPoints] = useState<string>('');
    const [reason, setReason] = useState('');
    const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');

    const activeCustomers = customers.filter(c => c.is_active);
    const customer = activeCustomers.find(c => c.id === selectedCustomer);

    const handleSubmit = () => {
        if (!customer || !points) return;

        const pointsNum = parseInt(points);
        if (isNaN(pointsNum) || pointsNum <= 0) return;

        const finalPoints = adjustType === 'add' ? pointsNum : -pointsNum;

        // Update customer balance
        updateCustomer(customer.id, {
            points_balance: Math.max(0, customer.points_balance + finalPoints),
        });

        // Log transaction
        adjustPoints(customer.id, customer.name, finalPoints, reason || (adjustType === 'add' ? 'Cộng điểm thủ công' : 'Trừ điểm thủ công'));

        // Reset form
        setPoints('');
        setReason('');
        alert('Đã điều chỉnh điểm thành công!');
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-bold text-lg mb-6">Điều chỉnh điểm thủ công</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Chọn khách hàng</label>
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full border rounded-lg px-4 py-3 text-base"
                        >
                            <option value="">-- Chọn khách hàng --</option>
                            {activeCustomers.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.phone || 'N/A'}) - {c.points_balance} điểm</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Loại điều chỉnh</label>
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={adjustType === 'add'}
                                    onChange={() => setAdjustType('add')}
                                    className="w-5 h-5 text-green-600"
                                />
                                <span className="text-green-600 font-semibold text-base">Cộng điểm</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={adjustType === 'subtract'}
                                    onChange={() => setAdjustType('subtract')}
                                    className="w-5 h-5 text-red-600"
                                />
                                <span className="text-red-600 font-semibold text-base">Trừ điểm</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Right Column - Points & Reason */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Số điểm</label>
                        <input
                            type="number"
                            value={points}
                            onChange={(e) => setPoints(e.target.value)}
                            placeholder="Nhập số điểm..."
                            className="w-full border rounded-lg px-4 py-3 text-base"
                            min="1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lý do</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Nhập lý do điều chỉnh..."
                            className="w-full border rounded-lg px-4 py-3 text-base"
                        />
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6 pt-6 border-t">
                <button
                    onClick={handleSubmit}
                    disabled={!selectedCustomer || !points}
                    className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition-colors text-base"
                >
                    Xác nhận điều chỉnh
                </button>
            </div>
        </div>
    );
}

// ============================================================================
// TIERS TAB - Membership Tier Display with Customer List Modal
// ============================================================================

function TiersTab() {
    const { tiers } = useLoyaltyStore();
    const { customers } = useCustomerStore();
    const [selectedTier, setSelectedTier] = useState<string | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

    // Count customers per tier and group them
    const { tierCounts, tierCustomers } = useMemo(() => {
        const counts: Record<string, number> = {};
        const grouped: Record<string, typeof customers> = {};
        tiers.forEach(t => {
            counts[t.id] = 0;
            grouped[t.id] = [];
        });

        customers.filter(c => c.is_active).forEach(c => {
            const spent = c.total_spent || 0;
            const sortedTiers = [...tiers].sort((a, b) => b.min_spent - a.min_spent);
            const tier = sortedTiers.find(t => spent >= t.min_spent);
            if (tier) {
                counts[tier.id]++;
                grouped[tier.id].push(c);
            }
        });

        return { tierCounts: counts, tierCustomers: grouped };
    }, [customers, tiers]);

    const selectedTierData = tiers.find(t => t.id === selectedTier);
    const customersInTier = selectedTier ? tierCustomers[selectedTier] || [] : [];

    return (
        <div className="space-y-6">
            <p className="text-slate-600">
                Hạng thành viên được xác định dựa trên tổng chi tiêu của khách hàng.
                Click vào mỗi hạng để xem danh sách thành viên.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {tiers.map((tier) => (
                    <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier.id)}
                        className="bg-white rounded-xl p-6 shadow-sm border text-center hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
                        style={{ borderTopColor: tier.color, borderTopWidth: '4px' }}
                    >
                        <div className="text-4xl mb-2">{tier.icon}</div>
                        <h3 className="font-bold text-lg" style={{ color: tier.color }}>{tier.name}</h3>
                        <p className="text-sm text-slate-500 mt-2">
                            Chi tiêu từ {formatVND(tier.min_spent)}
                        </p>
                        <p className="text-2xl font-bold text-slate-800 mt-4">
                            {tierCounts[tier.id] || 0}
                        </p>
                        <p className="text-xs text-slate-400">thành viên</p>
                    </button>
                ))}
            </div>

            {/* Customer List Modal */}
            {selectedTier && selectedTierData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setSelectedTier(null)}>
                    <div
                        className="bg-white rounded-xl p-6 w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col m-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{selectedTierData.icon}</span>
                                <div>
                                    <h3 className="font-bold text-xl" style={{ color: selectedTierData.color }}>
                                        Hạng {selectedTierData.name}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {customersInTier.length} thành viên • Chi tiêu từ {formatVND(selectedTierData.min_spent)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTier(null)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {customersInTier.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    Chưa có thành viên nào trong hạng này
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="text-left p-3 text-sm font-semibold text-slate-600">Tên</th>
                                            <th className="text-left p-3 text-sm font-semibold text-slate-600">SĐT</th>
                                            <th className="text-right p-3 text-sm font-semibold text-slate-600">Tổng chi tiêu</th>
                                            <th className="text-right p-3 text-sm font-semibold text-slate-600">Điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customersInTier
                                            .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
                                            .map(c => (
                                                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-3">
                                                        <button
                                                            onClick={() => setViewingCustomer(c)}
                                                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                                        >
                                                            {c.name}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-slate-600">{c.phone || '-'}</td>
                                                    <td className="p-3 text-right text-green-600 font-medium">{formatVND(c.total_spent || 0)}</td>
                                                    <td className="p-3 text-right text-amber-600 font-medium">{c.points_balance || 0}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Details Modal */}
            {viewingCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]" onClick={() => setViewingCustomer(null)}>
                    <div
                        className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto m-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                            <h3 className="font-bold text-lg">Thông tin khách hàng</h3>
                            <button
                                onClick={() => setViewingCustomer(null)}
                                className="text-slate-400 hover:text-slate-600 text-2xl"
                            >
                                ✕
                            </button>
                        </div>
                        <CustomerDetailsView
                            customer={viewingCustomer}
                            onBack={() => setViewingCustomer(null)}
                            onEdit={() => { }}
                            onDelete={() => { }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// ACTIVITY TAB - Transaction History
// ============================================================================

function ActivityTab() {
    const { transactions } = useLoyaltyStore();
    const [filter, setFilter] = useState<'all' | 'earn' | 'redeem' | 'adjust'>('all');

    const filteredTxs = useMemo(() => {
        return transactions
            .filter(t => filter === 'all' || t.type === filter)
            .slice(0, 100);
    }, [transactions, filter]);

    return (
        <div className="bg-white rounded-xl shadow-sm border">
            {/* Filters */}
            <div className="p-4 border-b flex gap-2">
                {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'earn', label: 'Tích điểm' },
                    { id: 'redeem', label: 'Đổi điểm' },
                    { id: 'adjust', label: 'Điều chỉnh' },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id as any)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                            filter === f.id
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="md:hidden divide-y divide-slate-100">
                {filteredTxs.map((tx) => (
                    <div key={tx.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                            <span className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium",
                                tx.type === 'earn' && "bg-green-100 text-green-700",
                                tx.type === 'redeem' && "bg-red-100 text-red-700",
                                tx.type === 'adjust' && "bg-blue-100 text-blue-700",
                            )}>
                                {tx.type === 'earn' && 'Tích điểm'}
                                {tx.type === 'redeem' && 'Đổi điểm'}
                                {tx.type === 'adjust' && 'Điều chỉnh'}
                            </span>
                            <span className="text-xs text-slate-500">
                                {new Date(tx.created_at).toLocaleString('vi-VN')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="font-medium text-slate-700">{tx.customer_name || tx.customer_id}</div>
                            <div className={cn(
                                "font-bold",
                                tx.points > 0 ? "text-green-600" : "text-red-600"
                            )}>
                                {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                            </div>
                        </div>
                        {tx.reason && (
                            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                {tx.reason}
                            </div>
                        )}
                    </div>
                ))}
                {filteredTxs.length === 0 && (
                    <div className="text-center py-8 text-slate-400">Chưa có hoạt động nào</div>
                )}
            </div>

            <table className="hidden md:table w-full text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="text-left p-3">Thời gian</th>
                        <th className="text-left p-3">Khách hàng</th>
                        <th className="text-left p-3">Loại</th>
                        <th className="text-right p-3">Điểm</th>
                        <th className="text-right p-3">Số dư sau</th>
                        <th className="text-left p-3">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTxs.map((tx) => (
                        <tr key={tx.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 text-slate-500">
                                {new Date(tx.created_at).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 font-medium">{tx.customer_name || tx.customer_id}</td>
                            <td className="p-3">
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    tx.type === 'earn' && "bg-green-100 text-green-700",
                                    tx.type === 'redeem' && "bg-red-100 text-red-700",
                                    tx.type === 'adjust' && "bg-blue-100 text-blue-700",
                                )}>
                                    {tx.type === 'earn' && 'Tích điểm'}
                                    {tx.type === 'redeem' && 'Đổi điểm'}
                                    {tx.type === 'adjust' && 'Điều chỉnh'}
                                </span>
                            </td>
                            <td className={cn(
                                "p-3 text-right font-bold",
                                tx.points > 0 ? "text-green-600" : "text-red-600"
                            )}>
                                {tx.points > 0 ? '+' : ''}{tx.points.toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-slate-600">{tx.balance_after.toLocaleString()}</td>
                            <td className="p-3 text-slate-500">{tx.reason || '-'}</td>
                        </tr>
                    ))}
                    {filteredTxs.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                                Chưa có hoạt động nào
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// CONFIG TAB - Loyalty Settings (moved from SettingsPage)
// ============================================================================

function ConfigTab() {
    const { loyalty, updateLoyalty } = useSettingsStore();
    const { config, updateConfig } = useLoyaltyStore();
    const { getCategories, updateItem } = useCategoryStore();
    const { products, updateProduct } = useProductStore();
    const categories = getCategories(); // Use getter to ensure fresh data

    // UI State for Exclusion Settings
    const [exclusionTab, setExclusionTab] = useState<'product' | 'category'>('category');
    const [searchTerm, setSearchTerm] = useState('');

    // Filtered lists for search
    const filteredItems = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();

        if (exclusionTab === 'category') {
            return categories
                .filter(c => c.type === 'category')
                .filter(c => !c.exclude_from_loyalty_points)
                .filter(c => c.name.toLowerCase().includes(term))
                .slice(0, 10);
        } else {
            return products
                .filter(p => !p.exclude_from_loyalty_points)
                .filter(p => p.name.toLowerCase().includes(term))
                .slice(0, 10);
        }
    }, [searchTerm, exclusionTab, categories, products]);

    // Items currently excluded (to display in table)
    const excludedList = useMemo(() => {
        if (exclusionTab === 'category') {
            return categories.filter(c => c.exclude_from_loyalty_points);
        } else {
            return products.filter(p => p.exclude_from_loyalty_points);
        }
    }, [exclusionTab, categories, products]);

    return (
        <div className="w-full max-w-4xl space-y-6">
            {/* Store Info */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">Thông tin cửa hàng</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên cửa hàng</label>
                        <input
                            type="text"
                            value={config.storeName}
                            onChange={(e) => updateConfig({ storeName: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SĐT liên hệ</label>
                        <input
                            type="text"
                            value={config.storePhone}
                            onChange={(e) => updateConfig({ storePhone: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email liên hệ</label>
                        <input
                            type="email"
                            value={config.storeEmail}
                            onChange={(e) => updateConfig({ storeEmail: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    </div>
                </div>
            </div>

            {/* Points Settings */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">Cài đặt tích điểm & đổi thưởng</h3>

                <div className="space-y-4">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={loyalty.enabled}
                            onChange={(e) => updateLoyalty({ enabled: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <span className="font-medium">Bật tính năng tích điểm</span>
                    </label>

                    {loyalty.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-8 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Chi tiêu bao nhiêu để được 1 điểm
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={loyalty.pointsPerAmount}
                                        onChange={(e) => updateLoyalty({ pointsPerAmount: Number(e.target.value) })}
                                        className="w-32 border rounded-lg px-3 py-2"
                                    />
                                    <span className="text-slate-500">VNĐ = 1 điểm</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    1 điểm đổi được bao nhiêu tiền
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500">1 điểm =</span>
                                    <input
                                        type="number"
                                        value={loyalty.redemptionRate}
                                        onChange={(e) => updateLoyalty({ redemptionRate: Number(e.target.value) })}
                                        className="w-32 border rounded-lg px-3 py-2"
                                    />
                                    <span className="text-slate-500">VNĐ</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Điểm tối thiểu để đổi
                                </label>
                                <input
                                    type="number"
                                    value={loyalty.minPointsToRedeem}
                                    onChange={(e) => updateLoyalty({ minPointsToRedeem: Number(e.target.value) })}
                                    className="w-32 border rounded-lg px-3 py-2"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Advanced Excluded Items Settings */}
            {loyalty.enabled && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-lg mb-4">Chính sách tích điểm theo sản phẩm</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Chọn các sản phẩm hoặc loại sản phẩm KHÔNG được tích điểm. Doanh thu từ các sản phẩm này sẽ bị trừ ra khi tính điểm thưởng.
                    </p>

                    <div className="space-y-6">
                        {/* Type Selection */}
                        <div className="flex gap-8 border-b pb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={exclusionTab === 'category'}
                                    onChange={() => { setExclusionTab('category'); setSearchTerm(''); }}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className={cn("font-medium", exclusionTab === 'category' ? "text-blue-600" : "text-slate-700")}>Loại sản phẩm</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={exclusionTab === 'product'}
                                    onChange={() => { setExclusionTab('product'); setSearchTerm(''); }}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className={cn("font-medium", exclusionTab === 'product' ? "text-blue-600" : "text-slate-700")}>Sản phẩm cụ thể</span>
                            </label>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-slate-700">Thêm {exclusionTab === 'category' ? 'loại sản phẩm' : 'sản phẩm'}:</span>
                            </div>
                            <input
                                type="text"
                                placeholder={exclusionTab === 'category' ? "Tìm kiếm loại sản phẩm..." : "Tìm kiếm sản phẩm..."}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />

                            {/* Search Results Dropdown */}
                            {searchTerm && filteredItems.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl mt-1 z-20 max-h-60 overflow-auto">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.id}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center border-b last:border-0"
                                            onClick={() => {
                                                if (exclusionTab === 'category') {
                                                    updateItem(item.id, 'category', { exclude_from_loyalty_points: true });
                                                } else {
                                                    updateProduct(item.id, { exclude_from_loyalty_points: true });
                                                }
                                                setSearchTerm('');
                                            }}
                                        >
                                            <span className="font-medium text-slate-800">{item.name}</span>
                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">Thêm</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Data Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="text-left p-4 font-semibold text-slate-600">Tên {exclusionTab === 'category' ? 'loại sản phẩm' : 'sản phẩm'}</th>
                                        <th className="text-center p-4 font-semibold text-slate-600">Quy đổi</th>
                                        <th className="text-center p-4 font-semibold text-slate-600 w-24">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {excludedList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-medium text-slate-800">{item.name}</td>
                                            <td className="p-4 text-center text-slate-500">0 điểm</td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        if (exclusionTab === 'category') {
                                                            updateItem(item.id, 'category', { exclude_from_loyalty_points: false });
                                                        } else {
                                                            updateProduct(item.id, { exclude_from_loyalty_points: false });
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                                                    title="Xóa"
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {excludedList.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-slate-400 italic bg-slate-50/50">
                                                Chưa có {exclusionTab === 'category' ? 'loại sản phẩm' : 'sản phẩm'} nào trong danh sách không tích điểm
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Activation */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">Cơ chế kích hoạt thành viên</h3>

                <div className="space-y-3">
                    <label className="flex items-center gap-3">
                        <input
                            type="radio"
                            checked={config.autoActivate}
                            onChange={() => updateConfig({ autoActivate: true })}
                            className="w-4 h-4 text-blue-600"
                        />
                        <div>
                            <span className="font-medium text-red-600">Kích hoạt tự động</span>
                            <p className="text-sm text-slate-500">Tự động kích hoạt thành viên khi có số điện thoại</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="radio"
                            checked={!config.autoActivate}
                            onChange={() => updateConfig({ autoActivate: false })}
                            className="w-4 h-4 text-blue-600"
                        />
                        <div>
                            <span className="font-medium">Kích hoạt thủ công</span>
                            <p className="text-sm text-slate-500">Khách hàng sẽ ở trạng thái chờ kích hoạt cho đến khi bạn kích hoạt thủ công</p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Phone Change Policy */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-lg mb-4">Cập nhật số điện thoại</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Xác định thao tác xử lý điểm và hạng thành viên sau khi cập nhật số điện thoại
                </p>

                <label className="flex items-center justify-between">
                    <div>
                        <span className="font-medium">Giữ nguyên điểm và hạng thành viên khi thay đổi số điện thoại</span>
                        <p className="text-sm text-blue-500">
                            Khi tắt cấu hình, điểm và hạng sẽ bị mất khi số điện thoại khách hàng cập nhật
                        </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={config.keepDataOnPhoneChange}
                        onChange={(e) => updateConfig({ keepDataOnPhoneChange: e.target.checked })}
                        className="w-10 h-6 rounded-full appearance-none bg-slate-300 checked:bg-blue-600 relative transition-colors cursor-pointer
                            before:content-[''] before:absolute before:top-1 before:left-1 before:w-4 before:h-4 before:bg-white before:rounded-full before:transition-transform
                            checked:before:translate-x-4"
                    />
                </label>
            </div>
        </div>
    );
}

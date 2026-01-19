import { useEffect, useState } from 'react';
import { useAffiliateStore } from '@/stores/affiliateStore';
import { Loading } from '@/components/common/Loading';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Copy, TrendingUp, DollarSign, Users, BookOpen, Download, Share2 } from 'lucide-react';

export function AffiliateDashboard() {
    // @ts-ignore - store was updated but TS might complain if not fully reloaded
    const { profile, commissions, fetchProfile, fetchCommissions, registerAffiliate, isLoading, error } = useAffiliateStore();
    const [isRegistering, setIsRegistering] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'commissions' | 'sales-kit'>('overview');
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (profile) {
            // @ts-ignore
            fetchCommissions();
        }
    }, [profile]);

    const handleRegister = async () => {
        setIsRegistering(true);
        // Simple auto-register for MVP. Future: Show modal for Bank Info.
        await registerAffiliate();
        setIsRegistering(false);
    };

    const handleWithdraw = () => {
        alert('Tính năng rút tiền đang được phát triển. Vui lòng liên hệ Admin để rút nhanh!');
        setShowWithdrawModal(false);
    };

    if (isLoading && !profile) return <Loading />;

    if (!profile && !isRegistering) {
        return (
            <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
                <ErrorAlert message={error} />
                <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">💰</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Trở thành Đối tác Tiếp thị (CTV)</h2>
                    <p className="text-gray-600 mb-8 text-lg">
                        Giới thiệu khách hàng sử dụng Bango POS và nhận hoa hồng hấp dẫn lên đến 40% trọn đời.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 text-left">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="font-bold text-green-600 text-xl mb-1">30-40%</div>
                            <div className="text-sm text-gray-500">Hoa hồng doanh thu</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="font-bold text-blue-600 text-xl mb-1">Trọn đời</div>
                            <div className="text-sm text-gray-500">Thu nhập thụ động</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="font-bold text-purple-600 text-xl mb-1">24/7</div>
                            <div className="text-sm text-gray-500">Hỗ trợ đối tác</div>
                        </div>
                    </div>

                    <button
                        onClick={handleRegister}
                        disabled={isLoading || isRegistering}
                        className="w-full md:w-auto bg-green-600 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRegistering ? 'Đang tạo tài khoản...' : 'Đăng ký CTV Ngay'}
                    </button>

                </div>
            </div>
        );
    }

    const referralLink = `${window.location.protocol}//${window.location.host}/dang-ky?ref=${profile?.code}`;

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span>👋</span> Xin chào, {profile?.code}
                    </h1>
                    <p className="text-gray-500 text-sm">Quản lý thu nhập và công cụ tiếp thị của bạn</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm flex items-center gap-2"
                    >
                        <DollarSign size={18} /> Rút tiền
                    </button>
                </div>
            </div>

            <ErrorAlert message={error} />

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <TrendingUp className="inline-block w-4 h-4 mr-2" />
                    Tổng quan
                </button>
                <button
                    onClick={() => setActiveTab('commissions')}
                    className={`pb-3 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'commissions' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign className="inline-block w-4 h-4 mr-2" />
                    Hoa hồng
                </button>
                <button
                    onClick={() => setActiveTab('sales-kit')}
                    className={`pb-3 px-4 text-sm font-medium whitespace-nowrap ${activeTab === 'sales-kit' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <BookOpen className="inline-block w-4 h-4 mr-2" />
                    Sales Kit (Tài liệu)
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-gray-500 mb-1 font-medium">Số dư khả dụng</p>
                                <h3 className="text-3xl font-bold text-gray-900">{profile?.balance?.toLocaleString()} ₫</h3>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-green-600">
                                <DollarSign size={80} />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-gray-500 mb-1 font-medium">Tổng thu nhập</p>
                                <h3 className="text-3xl font-bold text-gray-900">{profile?.total_earned?.toLocaleString()} ₫</h3>
                                <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                                    <span>↗</span> +0% tháng này
                                </div>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-blue-600">
                                <TrendingUp size={80} />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                            <p className="text-gray-500 mb-2 font-medium">Link giới thiệu</p>
                            <div className="flex items-center gap-2 mb-2">
                                <code className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 w-full truncate">
                                    {referralLink}
                                </code>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(referralLink);
                                    alert('Đã sao chép link!');
                                }}
                                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm font-medium border border-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                                <Copy size={14} /> Sao chép Link
                            </button>
                        </div>
                    </div>

                    {/* Recent Commissions Preview */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 text-lg">Hoa hồng mới nhất</h3>
                            <button onClick={() => setActiveTab('commissions')} className="text-sm text-blue-600 font-medium hover:underline">Xem tất cả</button>
                        </div>
                        {/* Table reused from previous implementation */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 font-semibold">Khách hàng</th>
                                        <th className="p-4 font-semibold">Thời gian</th>
                                        <th className="p-4 font-semibold text-right">Hoa hồng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {/* @ts-ignore */}
                                    {commissions && commissions.length > 0 ? commissions.slice(0, 5).map((comm) => (
                                        <tr key={comm.id}>
                                            <td className="p-4 font-medium">{comm.referral.brand_name || 'Khách ẩn'}</td>
                                            <td className="p-4 text-gray-500">{new Date(comm.created_at).toLocaleDateString('vi-VN')}</td>
                                            <td className="p-4 text-right font-bold text-green-600">+{comm.amount.toLocaleString()} ₫</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-400">Chưa có dữ liệu</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'commissions' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 text-lg">Lịch sử hoa hồng chi tiết</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-semibold">Khách hàng</th>
                                    <th className="p-4 font-semibold">Thời gian</th>
                                    <th className="p-4 font-semibold">Trạng thái</th>
                                    <th className="p-4 font-semibold text-right">Hoa hồng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {/* @ts-ignore */}
                                {commissions.map((comm) => (
                                    <tr key={comm.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{comm.referral.brand_name || 'Khách ẩn'}</div>
                                            <div className="text-xs text-gray-500">Gói PRO</div>
                                        </td>
                                        <td className="p-4 text-gray-600 text-sm">
                                            {new Date(comm.created_at).toLocaleDateString('vi-VN')}
                                            <div className="text-xs opacity-70">{new Date(comm.created_at).toLocaleTimeString('vi-VN')}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${comm.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                comm.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    comm.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {comm.status === 'paid' ? 'Đã nhận' :
                                                    comm.status === 'pending' ? 'Chờ duyệt' :
                                                        comm.status === 'approved' ? 'Đã duyệt' : 'Hủy'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-green-600">
                                            +{comm.amount.toLocaleString()} ₫
                                        </td>
                                    </tr>
                                ))}
                                {/* @ts-ignore */}
                                {commissions.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center text-gray-400">
                                            Chưa có hoa hồng nào. Hãy chia sẻ link ngay!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'sales-kit' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                            📢 Kịch bản giới thiệu (20s)
                        </h3>
                        <div className="bg-blue-50 p-4 rounded-lg text-blue-900 italic mb-4 border-l-4 border-blue-500">
                            "Bango POS là phần mềm bán hàng cho tạp hóa, mất mạng vẫn bán được, bán rất nhanh, in bill liền."
                        </div>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex gap-2">❌ <span className="line-through">Cloud, Server, SaaS</span> (Khách không hiểu)</li>
                            <li className="flex gap-2">✅ <span>Mất mạng vẫn bán được</span></li>
                            <li className="flex gap-2">✅ <span>In bill ngay lập tức</span></li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                            🎬 Kịch bản Demo (5 phút)
                        </h3>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                            <li><strong>Bán 1 đơn hàng:</strong> Quét mã hoặc chọn món → Thanh toán.</li>
                            <li><strong>In hóa đơn:</strong> Cho khách thấy tốc độ in.</li>
                            <li><strong>Tắt WiFi (Quan trọng):</strong> Thao tác bán tiếp → Chứng minh Offline Mode.</li>
                            <li><strong>Mở tồn kho:</strong> Cho thấy hàng bị trừ đúng số lượng.</li>
                            <li><strong>Chốt sale:</strong> "Anh/chị dùng thử tối nay, mai bán quen là không bỏ được."</li>
                        </ol>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
                            💰 Chính sách hoa hồng
                        </h3>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="py-2 px-3 text-left">Gói dịch vụ</th>
                                    <th className="py-2 px-3 text-right">Hoa hồng</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100">
                                    <td className="py-2 px-3">Basic (99k-149k)</td>
                                    <td className="py-2 px-3 text-right font-bold text-green-600">30%</td>
                                </tr>
                                <tr className="border-b border-gray-100">
                                    <td className="py-2 px-3">Pro (249k-399k)</td>
                                    <td className="py-2 px-3 text-right font-bold text-green-600">40%</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-3">Gia hạn</td>
                                    <td className="py-2 px-3 text-right font-bold text-blue-600">10-15%</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-500 mt-4">* Hoa hồng được thanh toán trong vòng 7 ngày.</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center text-center">
                        <Download className="w-12 h-12 text-gray-300 mb-4" />
                        <h3 className="font-bold text-gray-800 mb-2">Tài liệu đào tạo chi tiết</h3>
                        <p className="text-sm text-gray-500 mb-6">Tải trọn bộ tài liệu hướng dẫn bán hàng và xử lý từ chối.</p>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                            Tải về (PDF)
                        </button>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative" style={{ minWidth: '320px' }}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Yêu cầu rút tiền</h3>
                        <p className="text-gray-700 mb-6">
                            Tính năng rút tiền tự động đang được phát triển.
                            Hiện tại, vui lòng liên hệ Admin qua Zalo hoặc số điện thoại để yêu cầu rút tiền.
                            Chúng tôi sẽ xử lý yêu cầu của bạn trong thời gian sớm nhất.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowWithdrawModal(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                            >
                                Đóng
                            </button>
                            <button
                                onClick={handleWithdraw}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                            >
                                Liên hệ Admin
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

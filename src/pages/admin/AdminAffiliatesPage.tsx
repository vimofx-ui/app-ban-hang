import { AffiliateDashboard } from '@/pages/affiliate/AffiliateDashboard';

export function AdminAffiliatesPage() {
    return (
        <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="text-yellow-800 font-bold flex items-center gap-2">
                    ⚡ Chế độ Admin
                </h3>
                <p className="text-yellow-700 text-sm mt-1">
                    Bạn đang xem giao diện Đối tác (Affiliate) dưới quyền Admin.
                    <br />
                    (Tính năng Quản lý danh sách CTV và Duyệt rút tiền sẽ được cập nhật trong module này).
                </p>
            </div>

            {/* Reuse the dashboard for now, but in future this should be a List of Affiliates */}
            <AffiliateDashboard />
        </div>
    );
}

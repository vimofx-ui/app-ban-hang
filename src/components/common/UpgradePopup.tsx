import { useNavigate } from 'react-router-dom';

interface UpgradePopupProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'trial_expired' | 'feature_locked';
    featureName?: string;
}

export function UpgradePopup({ isOpen, onClose, reason = 'feature_locked', featureName }: UpgradePopupProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">

                {/* Background overlay */}
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                                <svg className="h-6 w-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    {reason === 'trial_expired' ? 'Gói dùng thử đã hết hạn' : 'Tính năng cao cấp'}
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500">
                                        {reason === 'trial_expired'
                                            ? 'Thời gian trải nghiệm miễn phí đã kết thúc. Dữ liệu của bạn vẫn được bảo toàn. Vui lòng nâng cấp gói để tiếp tục bán hàng.'
                                            : `Tính năng "${featureName}" chỉ dành cho gói Pro. Nâng cấp ngay để mở khóa toàn bộ sức mạnh của Bango POS.`
                                        }
                                    </p>
                                    <ul className="mt-4 text-sm text-gray-600 list-disc list-inside bg-gray-50 p-3 rounded-lg">
                                        <li>Bán hàng offline không lo mất mạng</li>
                                        <li>Quản lý chuỗi chi nhánh</li>
                                        <li>Báo cáo doanh thu chi tiết</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-base font-medium text-white hover:from-purple-700 hover:to-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={() => { onClose(); navigate('/pricing'); }}
                        >
                            Nâng cấp ngay
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            Để sau
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { MOCK_SUPPLIERS } from '../constants';
import { OrderSuggestion } from '../types';

interface Props {
    suggestions: OrderSuggestion[];
}

export const OrderManagementView: React.FC<Props> = ({ suggestions: initialSuggestions }) => {
    const [suggestions, setSuggestions] = useState<OrderSuggestion[]>(initialSuggestions);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    
    useEffect(() => {
        setSuggestions(initialSuggestions);
    }, [initialSuggestions]);

    // Order Execution State
    const [executingOrder, setExecutingOrder] = useState<OrderSuggestion | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const handleQuantityChange = (id: string, newQty: number) => {
        setSuggestions(prev => prev.map(item => 
            item.id === id ? { ...item, orderQty: newQty } : item
        ));
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const handleExecuteOrder = (item: OrderSuggestion) => {
        setExecutingOrder(item);
        setIsExecuting(true);
    };

    const confirmOrder = () => {
        if (!executingOrder) return;
        
        // Simulate sending
        setTimeout(() => {
            alert(`${executingOrder.supplierName}으로 ${executingOrder.orderQty}${executingOrder.unit} 발주가 ${executingOrder.method}로 전송되었습니다.`);
            setSuggestions(prev => prev.map(item => 
                item.id === executingOrder.id ? { ...item, status: 'Sent' } : item
            ));
            setIsExecuting(false);
            setExecutingOrder(null);
        }, 800);
    };

    const getTotalAmount = (item: OrderSuggestion) => item.orderQty * item.unitPrice;

    // Render Logic for different Order Methods
    const renderOrderPreview = (item: OrderSuggestion) => {
        const total = getTotalAmount(item).toLocaleString();
        const contact = MOCK_SUPPLIERS.find(s => s.id === item.supplierId)?.contact || "N/A";

        if (item.method === 'Email') {
            return (
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-800 font-mono text-sm">
                    <p className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                        <span className="font-bold text-gray-500">To:</span> {contact}
                    </p>
                    <p className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                        <span className="font-bold text-gray-500">Subject:</span> [발주요청] {item.skuName} 발주 건 (Z-CMS)
                    </p>
                    <div className="space-y-2 text-gray-800 dark:text-gray-300">
                        <p>안녕하세요, {item.supplierName} 담당자님.</p>
                        <p>아래와 같이 자재 발주를 요청드립니다.</p>
                        <ul className="list-disc list-inside pl-2 py-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                            <li>품목명: <strong>{item.skuName} ({item.skuCode})</strong></li>
                            <li>발주수량: <strong>{item.orderQty} {item.unit}</strong></li>
                            <li>납기요청일: {new Date(Date.now() + item.leadTime * 86400000).toLocaleDateString()} (Lead Time: {item.leadTime}일)</li>
                            <li>예상금액: ₩{total} (VAT 별도)</li>
                        </ul>
                        <p>확인 후 회신 부탁드립니다.<br/>감사합니다.</p>
                    </div>
                </div>
            );
        } else if (item.method === 'Kakao' || item.method === 'SMS') {
            return (
                <div className="max-w-xs mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 relative border border-yellow-200 dark:border-yellow-700">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-2 bg-white dark:bg-gray-800 px-2 text-xs font-bold rounded-full border border-gray-200">
                        {item.method === 'Kakao' ? '알림톡' : '문자메시지'}
                    </div>
                    <div className="text-sm space-y-1 text-gray-800 dark:text-gray-200">
                        <p className="font-bold">[Z-CMS 발주서]</p>
                        <p>{item.supplierName} 귀하</p>
                        <p>신규 발주가 접수되었습니다.</p>
                        <div className="my-2 border-t border-yellow-200 dark:border-yellow-700 pt-1">
                            <p>- 품목: {item.skuName}</p>
                            <p>- 수량: {item.orderQty} {item.unit}</p>
                            <p>- 금액: ₩{total}</p>
                        </div>
                        <p className="text-xs text-gray-500">하단 버튼을 눌러 수락해주세요.</p>
                        {item.method === 'Kakao' && (
                             <button className="w-full mt-2 bg-yellow-300 hover:bg-yellow-400 text-black text-xs font-bold py-2 rounded">발주 확인하기</button>
                        )}
                    </div>
                </div>
            );
        }
        return <p>지원하지 않는 발주 방식입니다.</p>;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">통계적 자재 발주 관리</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        안전재고 및 일일 소모량을 기반으로 계산된 권장 발주량입니다.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                    >
                        <span className="material-icons-outlined text-sm mr-2">upload_file</span>
                        품목/발주처 DB 업로드
                    </button>
                    <button className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
                        <span className="material-icons-outlined text-sm mr-2">send</span>
                        선택 항목 일괄 발주
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">
                                    <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary" />
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">품목 정보</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">공급사 (방식)</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">현재/안전재고</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">일평균 소모</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">추천 수량</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">실 발주 수량</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">실행</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                            {suggestions.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-6 text-gray-500">발주 추천 항목이 없습니다. (모든 재고가 안전합니다)</td></tr>
                            ) : (
                                suggestions.map((item) => (
                                <tr key={item.id} className={item.status === 'Sent' ? 'bg-gray-50 dark:bg-gray-900/50 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItems.has(item.id)}
                                            onChange={() => toggleSelection(item.id)}
                                            disabled={item.status === 'Sent'}
                                            className="rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50" 
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">{item.skuName}</span>
                                            <span className="text-xs text-gray-500">{item.skuCode}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">{item.supplierName}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                                                item.method === 'Email' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                item.method === 'Kakao' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}>
                                                {item.method === 'Email' ? '📧 메일' : item.method === 'Kakao' ? '💬 카톡' : '📱 문자'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="text-red-600 font-bold">{item.currentStock}</div>
                                        <div className="text-gray-400 text-xs">safe: {item.safetyStock}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm text-gray-700 dark:text-gray-300">
                                        {item.avgDailyConsumption} {item.unit}/day
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                            {item.suggestedQty}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="number"
                                            value={item.orderQty}
                                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                                            disabled={item.status === 'Sent'}
                                            className="w-24 px-2 py-1 text-right text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-primary focus:border-primary"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.status === 'Sent' ? (
                                            <span className="flex items-center justify-center text-green-600 text-sm font-medium">
                                                <span className="material-icons-outlined text-sm mr-1">check_circle</span>
                                                발송됨
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={() => handleExecuteOrder(item)}
                                                className="text-primary hover:text-primary-hover font-medium text-sm flex items-center justify-center"
                                            >
                                                발주
                                                <span className="material-icons-outlined text-sm ml-1">send</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DB Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">마스터 데이터 업로드</h3>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <span className="material-icons-outlined text-4xl text-gray-400 mb-2">cloud_upload</span>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">엑셀 파일을 드래그하거나 클릭하여 업로드</p>
                            <p className="text-xs text-gray-400 mt-1">지원 형식: .xlsx, .csv (최대 10MB)</p>
                        </div>
                        <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                             <a href="#" className="underline hover:text-primary">표준 템플릿 다운로드</a>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">취소</button>
                            <button onClick={() => { alert('업로드 시뮬레이션 완료'); setIsUploadModalOpen(false); }} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover">업로드</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Execution Confirmation Modal */}
            {isExecuting && executingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-lg p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-4">
                             <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">발주 전송 미리보기</h3>
                                <p className="text-sm text-gray-500">
                                    발송 수단: <span className="font-bold text-primary">{executingOrder.method}</span>
                                </p>
                             </div>
                             <button onClick={() => { setIsExecuting(false); setExecutingOrder(null); }} className="text-gray-400 hover:text-gray-600">
                                <span className="material-icons-outlined">close</span>
                             </button>
                        </div>

                        {/* Preview Area */}
                        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg mb-6 max-h-80 overflow-y-auto">
                            {renderOrderPreview(executingOrder)}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => { setIsExecuting(false); setExecutingOrder(null); }}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                취소
                            </button>
                            <button 
                                onClick={confirmOrder}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md text-sm font-medium shadow-sm flex items-center"
                            >
                                <span className="material-icons-outlined text-sm mr-2">send</span>
                                전송 확정
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
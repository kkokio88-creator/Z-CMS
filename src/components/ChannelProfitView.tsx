import React, { useState, useEffect } from 'react';
import { KPICardProps, ChannelProfitData, ChannelProfitabilityDetail } from '../types';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import {
  fetchChannelProfitability,
  formatCurrency,
  getMarginColorClass,
} from '../services/costAnalysisService';

interface Props {
  data: ChannelProfitData[];
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, isPositive, icon }) => (
  <div className="bg-white dark:bg-surface-dark rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      <p
        className={`text-xs font-medium mt-1 flex items-center ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
      >
        <span className="material-icons-outlined text-sm mr-0.5">
          {isPositive ? 'arrow_upward' : 'arrow_downward'}
        </span>
        {change} 전일 대비
      </p>
    </div>
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-full">
      <span className="material-icons-outlined text-primary dark:text-green-400 text-xl">
        {icon}
      </span>
    </div>
  </div>
);

// Empty state component for views without data
const NoDataState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
    <span className="material-icons-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
      cloud_off
    </span>
    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md px-4">{description}</p>
    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
      <p className="text-sm text-blue-700 dark:text-blue-300">
        <span className="font-bold">참고:</span> ECOUNT API 구독에서 판매 조회 API가 포함되어 있지
        않습니다. 판매 데이터를 보려면 ECOUNT에서 판매 조회 API를 구독하거나 수동으로 데이터를
        입력해야 합니다.
      </p>
    </div>
  </div>
);

// COGS Breakdown Colors
const COGS_COLORS = {
  rawMaterial: '#3B82F6',
  labor: '#10B981',
  logistics: '#F59E0B',
  commission: '#EF4444',
  packaging: '#8B5CF6',
  other: '#6B7280',
};

// Tab component
const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
      active
        ? 'border-primary text-primary dark:text-green-400 dark:border-green-400 bg-white dark:bg-surface-dark'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
    }`}
  >
    {children}
  </button>
);

export const ChannelProfitView: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'cogs' | 'contribution'>('daily');
  const [channelProfitability, setChannelProfitability] = useState<ChannelProfitabilityDetail[]>(
    []
  );
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'cogs' || activeTab === 'contribution') {
      loadChannelProfitability();
    }
  }, [activeTab]);

  const loadChannelProfitability = async () => {
    setIsLoading(true);
    try {
      const result = await fetchChannelProfitability('30days');
      setChannelProfitability(result);
      if (result.length > 0 && !selectedChannel) {
        setSelectedChannel(result[0].channelId);
      }
    } catch (e) {
      console.error('Failed to load channel profitability:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <NoDataState
        title="판매 데이터 없음"
        description="ECOUNT ERP에서 판매 이력 데이터를 가져올 수 없습니다."
      />
    );
  }

  // Get selected channel data for COGS breakdown
  const selectedChannelData = channelProfitability.find(c => c.channelId === selectedChannel);

  // Transform COGS data for pie chart
  const cogsChartData = selectedChannelData
    ? [
        {
          name: '원재료비',
          value: selectedChannelData.cogs.rawMaterial,
          color: COGS_COLORS.rawMaterial,
        },
        { name: '노무비', value: selectedChannelData.cogs.labor, color: COGS_COLORS.labor },
        { name: '물류비', value: selectedChannelData.cogs.logistics, color: COGS_COLORS.logistics },
        {
          name: '수수료',
          value: selectedChannelData.cogs.commission,
          color: COGS_COLORS.commission,
        },
        { name: '포장비', value: selectedChannelData.cogs.packaging, color: COGS_COLORS.packaging },
        { name: '기타', value: selectedChannelData.cogs.other, color: COGS_COLORS.other },
      ].filter(item => item.value > 0)
    : [];

  // Transform data for contribution margin comparison
  const contributionData = channelProfitability.map(c => ({
    name: c.channelName,
    grossMargin: c.grossMargin,
    contributionMargin: c.contributionMargin,
    netMargin: c.netMargin,
  }));

  // Daily Profit Tab Content
  const renderDailyTab = () => (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="기간 총 매출"
          value="₩1.2억"
          change="12.5%"
          isPositive={true}
          icon="payments"
        />
        <KPICard
          title="기간 영업이익"
          value="₩3,800만"
          change="8.4%"
          isPositive={true}
          icon="trending_up"
        />
        <KPICard
          title="평균 마진율"
          value="32.1%"
          change="1.2%"
          isPositive={false}
          icon="pie_chart"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            채널 통합 일별 손익 추이
          </h3>
          <div className="flex gap-2">
            <select
              className="text-sm border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-gray-600 dark:text-gray-300 py-1 px-2"
              onChange={(e) => {
                // 필터 기능은 데이터 연동 후 구현 예정
                console.log('채널 선택:', e.target.value);
              }}
            >
              <option value="all">전체 채널</option>
              <option value="coupang">쿠팡</option>
              <option value="own">자사몰</option>
              <option value="b2b">B2B</option>
            </select>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f5f5f5" vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                scale="band"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#8884d8"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#82ca9d"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  borderColor: '#374151',
                  color: '#F9FAFB',
                }}
                itemStyle={{ color: '#F9FAFB' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                name="매출"
                barSize={20}
                fill="#2F5E3E"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="profit"
                name="영업이익"
                barSize={20}
                fill="#86EFAC"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginRate"
                name="마진율"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-gray-900 dark:text-white">날짜별 상세 손익 데이터</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                날짜
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                매출
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                원가
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                영업이익
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                마진율
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                  {row.date}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-300">
                  ₩{formatCurrency(row.revenue)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-300">
                  ₩{formatCurrency(row.revenue - row.profit)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-bold text-primary dark:text-green-400">
                  ₩{formatCurrency(row.profit)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                  {row.marginRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  // COGS Breakdown Tab Content
  const renderCOGSTab = () => (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : channelProfitability.length === 0 ? (
        <NoDataState
          title="COGS 데이터 없음"
          description="채널별 원가 데이터를 불러올 수 없습니다."
        />
      ) : (
        <>
          {/* Channel Selector */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                채널 선택:
              </span>
              {channelProfitability.map(channel => (
                <button
                  key={channel.channelId}
                  onClick={() => setSelectedChannel(channel.channelId)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedChannel === channel.channelId
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {channel.channelName}
                </button>
              ))}
            </div>
          </div>

          {selectedChannelData && (
            <>
              {/* KPI Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">매출액</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₩{formatCurrency(selectedChannelData.revenue)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">총 원가 (COGS)</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    ₩{formatCurrency(selectedChannelData.totalCogs)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">매출총이익</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    ₩{formatCurrency(selectedChannelData.grossProfit)}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">매출총이익률</p>
                  <p
                    className={`text-xl font-bold ${selectedChannelData.grossMargin >= 20 ? 'text-green-600 dark:text-green-400' : selectedChannelData.grossMargin >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {selectedChannelData.grossMargin.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* COGS Breakdown Chart & Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    원가 구성 (COGS Breakdown)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cogsChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {cogsChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `₩${formatCurrency(value)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* COGS Detail Table */}
                <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    원가 항목별 상세
                  </h3>
                  <div className="space-y-3">
                    {cogsChartData.map((item, idx) => {
                      const percentage = (item.value / selectedChannelData.totalCogs) * 100;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              ₩{formatCurrency(item.value)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Trend Indicator */}
              <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`material-icons-outlined ${selectedChannelData.profitTrend === 'up' ? 'text-green-500' : selectedChannelData.profitTrend === 'down' ? 'text-red-500' : 'text-gray-500'}`}
                    >
                      {selectedChannelData.profitTrend === 'up'
                        ? 'trending_up'
                        : selectedChannelData.profitTrend === 'down'
                          ? 'trending_down'
                          : 'trending_flat'}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      전월 대비{' '}
                      {selectedChannelData.profitTrend === 'up'
                        ? '개선'
                        : selectedChannelData.profitTrend === 'down'
                          ? '악화'
                          : '유지'}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold ${selectedChannelData.trendPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {selectedChannelData.trendPercent >= 0 ? '+' : ''}
                    {selectedChannelData.trendPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  // Contribution Margin Tab Content
  const renderContributionTab = () => (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : channelProfitability.length === 0 ? (
        <NoDataState
          title="공헌이익 데이터 없음"
          description="채널별 공헌이익 데이터를 불러올 수 없습니다."
        />
      ) : (
        <>
          {/* Margin Comparison Bar Chart */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              채널별 이익률 비교
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contributionData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Bar
                    dataKey="grossMargin"
                    name="매출총이익률"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="contributionMargin"
                    name="공헌이익률"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="netMargin" name="순이익률" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Heatmap Table */}
          <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white">채널별 수익성 히트맵</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    채널
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    매출
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    매출총이익률
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    공헌이익률
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    순이익률
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    추세
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {channelProfitability.map((channel, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {channel.channelName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {channel.channelType}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      ₩{formatCurrency(channel.revenue)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${getMarginColorClass(channel.grossMargin)}`}
                      >
                        {channel.grossMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${getMarginColorClass(channel.contributionMargin)}`}
                      >
                        {channel.contributionMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-bold ${getMarginColorClass(channel.netMargin)}`}
                      >
                        {channel.netMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`material-icons-outlined text-lg ${
                          channel.profitTrend === 'up'
                            ? 'text-green-500'
                            : channel.profitTrend === 'down'
                              ? 'text-red-500'
                              : 'text-gray-400'
                        }`}
                      >
                        {channel.profitTrend === 'up'
                          ? 'arrow_upward'
                          : channel.profitTrend === 'down'
                            ? 'arrow_downward'
                            : 'remove'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channelProfitability
              .filter(c => c.contributionMargin < 15)
              .map((channel, idx) => (
                <div
                  key={idx}
                  className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-icons-outlined text-orange-500">warning</span>
                    <div>
                      <h4 className="text-sm font-bold text-orange-800 dark:text-orange-200">
                        {channel.channelName} 수익성 개선 필요
                      </h4>
                      <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                        공헌이익률 {channel.contributionMargin.toFixed(1)}% - 수수료 비중(
                        {((channel.cogs.commission / channel.totalCogs) * 100).toFixed(0)}%) 검토
                        권장
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <TabButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
            일별 손익
          </TabButton>
          <TabButton active={activeTab === 'cogs'} onClick={() => setActiveTab('cogs')}>
            COGS 분해
          </TabButton>
          <TabButton
            active={activeTab === 'contribution'}
            onClick={() => setActiveTab('contribution')}
          >
            공헌이익률 분석
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'daily' && renderDailyTab()}
      {activeTab === 'cogs' && renderCOGSTab()}
      {activeTab === 'contribution' && renderContributionTab()}
    </div>
  );
};

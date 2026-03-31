import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Users, AlertTriangle } from 'lucide-react';

interface Totals {
  total_sessions: number;
  total_requeue: number;
  requeue_percent: number;
  top_issue: string;
}

interface Agent {
  user_id: string;
  total_sessions: number;
  id_retake: number;
  tech_issue: number;
  system_issue: number;
  requeue_percent: number;
}

export default function Admin() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetchSummary();
  }, [date]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/summary?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch summary');
      
      setTotals(data.totals);
      setAgents(data.agents);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHighlightClass = (percent: number) => {
    if (percent >= 30) return 'bg-red-50 text-red-700 font-semibold';
    if (percent < 10) return 'bg-green-50 text-green-700 font-semibold';
    return 'text-gray-900';
  };

  const topWorst = [...agents].sort((a, b) => b.requeue_percent - a.requeue_percent).slice(0, 3);
  const topBest = [...agents].sort((a, b) => a.requeue_percent - b.requeue_percent).slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">TL Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Daily summary and agent performance</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full sm:w-auto border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-4 py-2 border"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : totals ? (
          <>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Sessions</dt>
                        <dd className="text-2xl font-semibold text-gray-900">{totals.total_sessions}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-orange-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Requeue</dt>
                        <dd className="text-2xl font-semibold text-gray-900">{totals.total_requeue}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Requeue %</dt>
                        <dd className={`text-2xl font-semibold ${totals.requeue_percent >= 30 ? 'text-red-600' : totals.requeue_percent < 10 ? 'text-green-600' : 'text-gray-900'}`}>
                          {totals.requeue_percent.toFixed(2)}%
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-6 w-6 text-purple-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Top Issue</dt>
                        <dd className="text-lg font-semibold text-gray-900 truncate">{totals.top_issue}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white shadow rounded-lg border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <TrendingDown className="w-5 h-5 text-red-500 mr-2" />
                  Top 3 Highest Requeue (Needs Attention)
                </h3>
                <ul className="divide-y divide-gray-200">
                  {topWorst.length > 0 ? topWorst.map(agent => (
                    <li key={agent.user_id} className="py-3 flex justify-between items-center">
                      <span className="font-medium text-gray-900">{agent.user_id}</span>
                      <span className="text-red-600 font-semibold">{agent.requeue_percent.toFixed(2)}%</span>
                    </li>
                  )) : <li className="py-3 text-gray-500 text-sm">No data available</li>}
                </ul>
              </div>

              <div className="bg-white shadow rounded-lg border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
                  Top 3 Lowest Requeue (Excellent)
                </h3>
                <ul className="divide-y divide-gray-200">
                  {topBest.length > 0 ? topBest.map(agent => (
                    <li key={agent.user_id} className="py-3 flex justify-between items-center">
                      <span className="font-medium text-gray-900">{agent.user_id}</span>
                      <span className="text-green-600 font-semibold">{agent.requeue_percent.toFixed(2)}%</span>
                    </li>
                  )) : <li className="py-3 text-gray-500 text-sm">No data available</li>}
                </ul>
              </div>
            </div>

            {/* Core Table */}
            <div className="bg-white shadow rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Agent Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sessions</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Retake</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tech Issue</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Issue</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requeue %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {agents.map((agent) => (
                      <tr key={agent.user_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.user_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.total_sessions}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.id_retake}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.tech_issue}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.system_issue}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${getHighlightClass(agent.requeue_percent)}`}>
                          {agent.requeue_percent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                    {agents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          No reports found for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

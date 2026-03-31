import React, { useState } from 'react';
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState('');
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [idRetake, setIdRetake] = useState<number>(0);
  const [techIssue, setTechIssue] = useState<number>(0);
  const [systemIssue, setSystemIssue] = useState<number>(0);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setTotalSessions(data.total_sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId.trim()) {
      setError('Agent ID is required');
      return;
    }

    if (totalSessions === null) {
      setError('Please upload a file to calculate total sessions first');
      return;
    }

    const totalRequeue = idRetake + techIssue + systemIssue;
    if (totalRequeue > totalSessions) {
      setError(`Total requeues (${totalRequeue}) cannot exceed total sessions (${totalSessions})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          date: today,
          total_sessions: totalSessions,
          id_retake: idRetake,
          tech_issue: techIssue,
          system_issue: systemIssue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit data');
      }

      setSuccess(true);
      // Reset form
      setFile(null);
      setTotalSessions(null);
      setIdRetake(0);
      setTechIssue(0);
      setSystemIssue(0);
      
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    setError(null);
    setEmailSuccess(false);

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      setEmailSuccess(true);
      setTimeout(() => {
        setEmailSuccess(false);
      }, 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Daily Ops Report
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Submit your daily session data
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">Report submitted successfully!</p>
              </div>
            </div>
          </div>
        )}

        {emailSuccess && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">Email report sent successfully!</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: File Upload */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Upload Session File</h3>
            <div className="flex items-center justify-center w-full">
              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-8 h-8 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">CSV or Excel files only</p>
                </div>
                <input 
                  id="dropzone-file" 
                  type="file" 
                  className="hidden" 
                  accept=".csv, .xlsx, .xls" 
                  onChange={handleFileChange}
                />
              </label>
            </div>
            
            {file && (
              <div className="mt-4 flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                <span className="text-sm text-gray-600 truncate max-w-[200px]">{file.name}</span>
                <button
                  onClick={handleUpload}
                  disabled={isUploading || totalSessions !== null}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Process File'}
                </button>
              </div>
            )}

            {totalSessions !== null && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm font-medium flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Processed: {totalSessions} total sessions found
              </div>
            )}
          </div>

          {/* Step 2: Manual Entry Form */}
          <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">2. Enter Requeue Details</h3>
            
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                Agent ID / Name
              </label>
              <input
                type="text"
                id="userId"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="e.g. AGENT-001"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="idRetake" className="block text-xs font-medium text-gray-700">
                  ID Retake
                </label>
                <input
                  type="number"
                  id="idRetake"
                  min="0"
                  required
                  value={idRetake}
                  onChange={(e) => setIdRetake(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="techIssue" className="block text-xs font-medium text-gray-700">
                  Tech Transfer
                </label>
                <input
                  type="number"
                  id="techIssue"
                  min="0"
                  required
                  value={techIssue}
                  onChange={(e) => setTechIssue(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="systemIssue" className="block text-xs font-medium text-gray-700">
                  System Issue
                </label>
                <input
                  type="number"
                  id="systemIssue"
                  min="0"
                  required
                  value={systemIssue}
                  onChange={(e) => setSystemIssue(parseInt(e.target.value) || 0)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || totalSessions === null}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Submit Daily Report
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Step 3: Send Email Report */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">3. Send Daily Summary</h3>
            <p className="text-sm text-gray-600 mb-4">
              Manually trigger the daily aggregate report email to the team lead. This also runs automatically at 6 PM.
            </p>
            <button
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Email Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-black text-white">404 — Page Not Found</h1>
      <p className="text-xs text-slate-400 leading-relaxed">
        The requested document or interface route does not exist, or has been classified.
      </p>
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Safety</span>
      </button>
    </div>
  );
};

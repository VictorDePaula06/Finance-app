import { useState } from 'react';
import TransactionSection from './components/TransactionSection';
import GoalTracker from './components/GoalTracker';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutDashboard, LogOut } from 'lucide-react';

function Dashboard() {
  const { logout, currentUser } = useAuth();

  return (
    <div className="min-h-screen text-slate-50 p-6 md:p-12 relative">
      {/* Background overlay for better text readability if needed, but keeping it minimal for now */}
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/20">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Finance Control
              </h1>
              <p className="text-slate-400 text-sm">Gerencie seus ativos e metas</p>
              <p className="text-emerald-400 font-medium tracking-wide mt-1 animate-in fade-in slide-in-from-left-3">
                👋 Olá, <span className="text-slate-100">{currentUser?.displayName?.split(' ')[0] || 'Usuário'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden md:block">{currentUser?.email}</span>
            <button
              onClick={logout}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Goal Section */}
        <section>
          <GoalTracker />
        </section>

        {/* Transactions Section */}
        <section>
          <TransactionSection />
        </section>

      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser } = useAuth();
  return currentUser ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

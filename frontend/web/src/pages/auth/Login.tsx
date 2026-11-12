import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

const isDemoEnvironment = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

const DEMO_ACCOUNTS = [
  {
    name: 'Admin',
    role: 'ADMINISTRATOR',
    email: 'admin@ecoflow.internal',
    password: isDemoEnvironment ? 'Password123!' : '',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    name: 'Lead Engineer',
    role: 'LEAD_ENGINEER',
    email: 'engineer@ecoflow.internal',
    password: isDemoEnvironment ? 'Password123!' : '',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    name: 'Approver',
    role: 'APPROVER',
    email: 'approver@ecoflow.internal',
    password: isDemoEnvironment ? 'Password123!' : '',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  {
    name: 'Operator',
    role: 'OPERATOR',
    email: 'operator@ecoflow.internal',
    password: isDemoEnvironment ? 'Password123!' : '',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
  },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        setError('Unable to connect to ECOFlow backend API (port 4000). Please ensure the backend server is running.');
      } else {
        setError(err.response?.data?.error?.message || 'Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.role);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg mb-4">
          EF
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">ECOFlow</h2>
        <p className="mt-2 text-sm text-slate-400">Engineering Change Order & PLM Platform</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Email Address</label>
              <div className="mt-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRole(null);
                  }}
                  placeholder="engineer@ecoflow.internal"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">Password</label>
              <div className="mt-1.5">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedRole(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full py-2.5">
              <span>Sign in to Workspace</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Credentials Autofill — Only rendered in development/demo environments */}
          {isDemoEnvironment && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Autofill Demo RBAC Accounts
                </span>
                <span className="text-[10px] text-teal-600 font-medium bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                  Demo Mode
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = selectedRole === acc.role;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleSelectDemo(acc)}
                      className={`p-2.5 text-left rounded-xl border transition-all relative ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-600/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900">{acc.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono tracking-tight">{acc.role}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4 text-center">
            <span className="text-xs text-slate-500">Need a custom account? </span>
            <Link to="/register" className="text-xs font-semibold text-primary hover:underline">
              Register now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


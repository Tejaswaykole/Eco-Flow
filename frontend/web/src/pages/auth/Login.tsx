import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Shield, AlertCircle, ArrowRight } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err.response?.data?.error?.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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

          {/* Quick Demo Credentials Autofill */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Autofill Demo RBAC Accounts
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@ecoflow.internal');
                  setPassword('Password123!');
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-primary hover:bg-slate-50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Admin</div>
                <div className="text-[10px] text-slate-400">ADMINISTRATOR</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('engineer@ecoflow.internal');
                  setPassword('Password123!');
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-primary hover:bg-slate-50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Lead Engineer</div>
                <div className="text-[10px] text-slate-400">LEAD_ENGINEER</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('approver@ecoflow.internal');
                  setPassword('Password123!');
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-primary hover:bg-slate-50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Approver</div>
                <div className="text-[10px] text-slate-400">APPROVER</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('operator@ecoflow.internal');
                  setPassword('Password123!');
                }}
                className="p-2 text-left rounded-lg border border-slate-200 hover:border-primary hover:bg-slate-50 transition-colors"
              >
                <div className="font-semibold text-slate-800">Operator</div>
                <div className="text-[10px] text-slate-400">OPERATOR</div>
              </button>
            </div>
          </div>

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


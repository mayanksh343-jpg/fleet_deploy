import { useState } from 'react';
import { Truck, Sun, Moon, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

interface LoginPageProps {
  onLogin: (user: { id: number; name: string; email: string; role: string }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Signup flow
        if (!formData.name || !formData.email || !formData.password || !formData.role) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        const result = await api.auth.signup({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        });
        onLogin(result.user);
      } else {
        // Login flow
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        const result = await api.auth.login({
          email: formData.email,
          password: formData.password,
        });
        onLogin(result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-10 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Moon className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-4 sm:p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">FleetFlow</span>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-muted-foreground">
              {isRegister
                ? 'Register to manage your fleet efficiently'
                : 'Sign in to access your fleet dashboard'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-[#EF4444]/10 text-[#EF4444] px-4 py-3 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field — only for registration */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setResetSent(false); setResetEmail(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 cursor-pointer"
                >
                  Forgot Password?
                </button>
              )}
            </div>

            {/* Role selector — only for registration */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Manager">Fleet Manager</SelectItem>
                    <SelectItem value="Dispatcher">Dispatcher</SelectItem>
                    <SelectItem value="Safety Officer">Safety Officer</SelectItem>
                    <SelectItem value="Financial Analyst">Financial Analyst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isRegister ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Register"}
            </button>
          </div>

          {/* Forgot Password Modal */}
          {showForgotPassword && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold text-foreground mb-2">Reset Password</h3>
                {resetSent ? (
                  <div>
                    <div className="bg-[#22C55E]/10 text-[#22C55E] px-4 py-3 rounded-lg text-sm mb-4">
                      ✓ Password reset link sent to <strong>{resetEmail}</strong>. Check your inbox.
                    </div>
                    <Button
                      onClick={() => setShowForgotPassword(false)}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Back to Login
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enter your email address and we'll send you a reset link.
                    </p>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="bg-background border-border text-foreground mb-4"
                    />
                    <div className="flex gap-3">
                      <Button
                        onClick={() => { if (resetEmail) setResetSent(true); }}
                        disabled={!resetEmail}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Send Reset Link
                      </Button>
                      <Button
                        onClick={() => setShowForgotPassword(false)}
                        variant="outline"
                        className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-card items-center justify-center p-8 transition-colors duration-300">
        <div className="max-w-lg text-center">
          <div className="mb-6">
            <div className="w-32 h-32 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-16 h-16 text-[#22C55E]" />
            </div>
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Fleet Management Made Simple
            </h2>
            <p className="text-lg text-muted-foreground">
              Streamline your logistics operations with real-time tracking, maintenance scheduling, and comprehensive analytics.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-background p-4 rounded-lg border border-border transition-colors duration-300">
              <p className="text-2xl font-bold text-[#22C55E]">500+</p>
              <p className="text-xs text-muted-foreground">Vehicles</p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border transition-colors duration-300">
              <p className="text-2xl font-bold text-[#22C55E]">98%</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="bg-background p-4 rounded-lg border border-border transition-colors duration-300">
              <p className="text-2xl font-bold text-[#22C55E]">24/7</p>
              <p className="text-xs text-muted-foreground">Support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

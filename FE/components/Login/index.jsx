import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, register as apiRegister } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';

export default function Login() {
  const { locale } = useDashboard();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem('mkt_hub_token');
    localStorage.removeItem('mkt_hub_user');
    sessionStorage.removeItem('mkt_hub_dashboard');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError({ vi: 'Vui lòng nhập email và mật khẩu', en: 'Please enter email and password' }[locale]);
      return;
    }
    if (!isValidEmail(email)) {
      setError({ vi: 'Email không đúng định dạng', en: 'Invalid email format' }[locale]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiLogin(email, password);
      localStorage.setItem('mkt_hub_user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      const errData = err?.response?.data;
      const msg = Array.isArray(errData?.message) ? errData.message.join('; ')
        : errData?.message || errData?.error || err?.message || ({ vi: 'Email hoặc mật khẩu không chính xác', en: 'Incorrect email or password' })[locale];
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError({ vi: 'Vui lòng nhập đầy đủ thông tin', en: 'Please fill in all information' }[locale]);
      return;
    }
    if (!isValidEmail(email)) {
      setError({ vi: 'Email không đúng định dạng', en: 'Invalid email format' }[locale]);
      return;
    }
    if (password !== confirmPassword) {
      setError({ vi: 'Mật khẩu xác nhận không khớp', en: 'Confirm password does not match' }[locale]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiRegister(name, email, password);
      localStorage.setItem('mkt_hub_user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      const errData = err?.response?.data;
      const msg = Array.isArray(errData?.message) ? errData.message.join('; ')
        : errData?.message || errData?.error || err?.message || ({ vi: 'Đăng ký thất bại', en: 'Registration failed' })[locale];
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-sidebar-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl card-shadow border border-border-light p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-white text-3xl">hub</span>
            </div>
            <h1 className="text-headline-lg font-headline-lg text-on-surface">MKT Hub</h1>
            <p className="text-body-md text-on-surface-variant mt-1">{{ vi: 'Vận hành Marketing', en: 'Marketing Operations' }[locale]}</p>
          </div>

          <div className="flex mb-6 bg-surface-container-low rounded-lg p-1" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 text-label-md font-semibold rounded-md transition-colors ${tab === 'login' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {{ vi: 'Đăng nhập', en: 'Login' }[locale]}
            </button>
            <button
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 text-label-md font-semibold rounded-md transition-colors ${tab === 'register' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {{ vi: 'Đăng ký', en: 'Register' }[locale]}
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-label-md text-on-surface-variant">{{ vi: 'Email', en: 'Email' }[locale]}</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder={{ vi: 'Nhập email', en: 'Enter email' }[locale]}
                  aria-describedby={error ? 'login-error' : undefined}
                  aria-invalid={error ? 'true' : undefined}
                  className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-label-md text-on-surface-variant">{{ vi: 'Mật khẩu', en: 'Password' }[locale]}</label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    aria-describedby={error ? 'login-error' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    className="w-full px-3 py-2.5 pr-10 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? ({ vi: 'Ẩn mật khẩu', en: 'Hide password' })[locale] : ({ vi: 'Hiện mật khẩu', en: 'Show password' })[locale]} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div id="login-error" role="alert" className="bg-red-50 border-l-4 border-danger p-3 rounded">
                  <p className="text-body-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-body-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? ({ vi: 'Đang đăng nhập...', en: 'Logging in...' })[locale] : ({ vi: 'Đăng nhập', en: 'Login' })[locale]}
              </button>

            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="text-label-md text-on-surface-variant">{{ vi: 'Họ tên', en: 'Full Name' }[locale]}</label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="Nguyễn Văn A"
                  aria-describedby={error ? 'reg-error' : undefined}
                  aria-invalid={error ? 'true' : undefined}
                  className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-email" className="text-label-md text-on-surface-variant">{{ vi: 'Email', en: 'Email' }[locale]}</label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="email@example.com"
                  aria-describedby={error ? 'reg-error' : undefined}
                  aria-invalid={error ? 'true' : undefined}
                  className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-password" className="text-label-md text-on-surface-variant">{{ vi: 'Mật khẩu', en: 'Password' }[locale]}</label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    aria-describedby={error ? 'reg-error' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    className="w-full px-3 py-2.5 pr-10 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? ({ vi: 'Ẩn mật khẩu', en: 'Hide password' })[locale] : ({ vi: 'Hiện mật khẩu', en: 'Show password' })[locale]} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-confirm-password" className="text-label-md text-on-surface-variant">{{ vi: 'Xác nhận mật khẩu', en: 'Confirm Password' }[locale]}</label>
                <div className="relative">
                  <input
                    id="reg-confirm-password"
                    name="confirmPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    aria-describedby={error ? 'reg-error' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    className="w-full px-3 py-2.5 pr-10 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} aria-pressed={showNewPassword} aria-label={showNewPassword ? ({ vi: 'Ẩn mật khẩu', en: 'Hide password' })[locale] : ({ vi: 'Hiện mật khẩu', en: 'Show password' })[locale]} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                    <span className="material-symbols-outlined text-[20px]">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {error && (
                <div id="reg-error" role="alert" className="bg-red-50 border-l-4 border-danger p-3 rounded">
                  <p className="text-body-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-body-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? ({ vi: 'Đang đăng ký...', en: 'Registering...' })[locale] : ({ vi: 'Đăng ký', en: 'Register' })[locale]}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

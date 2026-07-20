import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, register as apiRegister } from '../../services/api';

export default function Login() {
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
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiLogin(email, password);
      localStorage.setItem('mkt_hub_user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err) {
      const errData = err?.response?.data;
      const msg = Array.isArray(errData?.message) ? errData.message.join('; ')
        : errData?.message || errData?.error || err?.message || 'Email hoặc mật khẩu không chính xác';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Email không đúng định dạng');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
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
        : errData?.message || errData?.error || err?.message || 'Đăng ký thất bại';
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
            <p className="text-body-md text-on-surface-variant mt-1">Vận hành Marketing</p>
          </div>

          <div className="flex mb-6 bg-surface-container-low rounded-lg p-1" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 text-label-md font-semibold rounded-md transition-colors ${tab === 'login' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Đăng nhập
            </button>
            <button
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 text-label-md font-semibold rounded-md transition-colors ${tab === 'register' ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Đăng ký
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-label-md text-on-surface-variant">Email</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="Nhập email"
                  aria-describedby={error ? 'login-error' : undefined}
                  aria-invalid={error ? 'true' : undefined}
                  className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-label-md text-on-surface-variant">Mật khẩu</label>
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
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
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
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>

            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="reg-name" className="text-label-md text-on-surface-variant">Họ tên</label>
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
                <label htmlFor="reg-email" className="text-label-md text-on-surface-variant">Email</label>
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
                <label htmlFor="reg-password" className="text-label-md text-on-surface-variant">Mật khẩu</label>
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
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-confirm-password" className="text-label-md text-on-surface-variant">Xác nhận mật khẩu</label>
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
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} aria-pressed={showNewPassword} aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
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
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

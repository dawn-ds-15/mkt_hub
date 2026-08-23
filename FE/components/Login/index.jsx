import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, register as apiRegister, forgotPassword, verifyOtp, resetPassword } from '../../services/api';
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

  const [forgotStep, setForgotStep] = useState('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem('mkt_hub_token');
    localStorage.removeItem('mkt_hub_user');
    sessionStorage.removeItem('mkt_hub_dashboard');
  }, []);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

  const openForgot = () => {
    setTab('forgot');
    setError('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setForgotEmail(email);
    setForgotOtp('');
    setForgotNewPass('');
    setForgotConfirmPass('');
    setFpError('');
    setFpSuccess('');
    setForgotStep('email');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpSuccess('');
    if (!forgotEmail) {
      setFpError({ vi: 'Vui lòng nhập email', en: 'Please enter your email' }[locale]);
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setFpError({ vi: 'Email không đúng định dạng', en: 'Invalid email format' }[locale]);
      return;
    }
    setFpLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotStep('reset');
      setFpSuccess({ vi: 'Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.', en: 'An OTP code has been sent to your email. Please check your inbox.' }[locale]);
    } catch (err) {
      const errData = err?.response?.data;
      setFpError(
        Array.isArray(errData?.message) ? errData.message.join('; ')
          : errData?.message || errData?.error || { vi: 'Không gửi được mã OTP. Vui lòng thử lại.', en: 'Could not send OTP. Please try again.' }[locale]
      );
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpSuccess('');
    if (!forgotOtp || !forgotNewPass || !forgotConfirmPass) {
      setFpError({ vi: 'Vui lòng nhập đầy đủ mã OTP và mật khẩu mới', en: 'Please enter the OTP and new password' }[locale]);
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setFpError({ vi: 'Mật khẩu xác nhận không khớp', en: 'Confirm password does not match' }[locale]);
      return;
    }
    setFpLoading(true);
    let otpValid = true;
    try {
      await verifyOtp(forgotEmail, forgotOtp);
    } catch (err) {
      otpValid = false;
      const errData = err?.response?.data;
      setFpError(
        Array.isArray(errData?.message) ? errData.message.join('; ')
          : errData?.message || errData?.error || { vi: 'Mã OTP không đúng hoặc đã hết hạn', en: 'OTP is invalid or expired' }[locale]
      );
    }
    if (otpValid) {
      try {
        await resetPassword(forgotEmail, forgotOtp, forgotNewPass);
        setForgotStep('done');
        setFpSuccess({ vi: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.', en: 'Password reset successfully! You can now log in with your new password.' }[locale]);
      } catch (err) {
        const errData = err?.response?.data;
        setFpError(
          Array.isArray(errData?.message) ? errData.message.join('; ')
            : errData?.message || errData?.error || { vi: 'Không đặt lại được mật khẩu. Vui lòng thử lại.', en: 'Could not reset password. Please try again.' }[locale]
        );
      }
    }
    setFpLoading(false);
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

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-body-sm text-primary hover:underline"
                >
                  {{ vi: 'Quên mật khẩu?', en: 'Forgot password?' }[locale]}
                </button>
              </div>

            </form>
          ) : tab === 'forgot' ? (
            <div className="space-y-5">
              {forgotStep !== 'done' && (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  {{ vi: 'Quay lại đăng nhập', en: 'Back to login' }[locale]}
                </button>
              )}

              {forgotStep === 'email' && (
                <form onSubmit={handleSendOtp} noValidate className="space-y-5">
                  <p className="text-body-sm text-on-surface-variant">
                    {{ vi: 'Nhập email đăng ký của bạn, chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.', en: 'Enter your registered email and we will send you an OTP code to reset your password.' }[locale]}
                  </p>
                  <div className="space-y-1.5">
                    <label htmlFor="fp-email" className="text-label-md text-on-surface-variant">{{ vi: 'Email', en: 'Email' }[locale]}</label>
                    <input
                      id="fp-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={forgotEmail}
                      onChange={(e) => { setForgotEmail(e.target.value); setFpError(''); }}
                      placeholder={{ vi: 'Nhập email', en: 'Enter email' }[locale]}
                      aria-describedby={fpError ? 'fp-error' : undefined}
                      aria-invalid={fpError ? 'true' : undefined}
                      className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                    />
                  </div>
                  {fpError && (
                    <div id="fp-error" role="alert" className="bg-red-50 border-l-4 border-danger p-3 rounded">
                      <p className="text-body-sm text-red-800">{fpError}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-body-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? ({ vi: 'Đang gửi...', en: 'Sending...' })[locale] : ({ vi: 'Gửi mã OTP', en: 'Send OTP' }[locale])}
                  </button>
                </form>
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleResetPassword} noValidate className="space-y-5">
                  <p className="text-body-sm text-on-surface-variant">
                    {{ vi: 'Nhập mã OTP đã gửi tới', en: 'Enter the OTP code sent to' }[locale]} <strong>{forgotEmail}</strong>
                  </p>
                  <div className="space-y-1.5">
                    <label htmlFor="fp-otp" className="text-label-md text-on-surface-variant">{{ vi: 'Mã OTP', en: 'OTP Code' }[locale]}</label>
                    <input
                      id="fp-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={forgotOtp}
                      onChange={(e) => { setForgotOtp(e.target.value.replace(/[^\d]/g, '')); setFpError(''); }}
                      placeholder={{ vi: 'Nhập mã OTP', en: 'Enter OTP' }[locale]}
                      aria-invalid={fpError ? 'true' : undefined}
                      className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface tracking-[0.4em] text-center bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline placeholder:tracking-normal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="fp-new-password" className="text-label-md text-on-surface-variant">{{ vi: 'Mật khẩu mới', en: 'New Password' }[locale]}</label>
                    <div className="relative">
                      <input
                        id="fp-new-password"
                        name="newPassword"
                        type={showForgotPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={forgotNewPass}
                        onChange={(e) => { setForgotNewPass(e.target.value); setFpError(''); }}
                        placeholder="••••••••"
                        aria-invalid={fpError ? 'true' : undefined}
                        className="w-full px-3 py-2.5 pr-10 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                      />
                      <button type="button" onClick={() => setShowForgotPass(!showForgotPass)} aria-pressed={showForgotPass} aria-label={{ vi: 'Hiện/ẩn mật khẩu', en: 'Show/hide password' }[locale]} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1">
                        <span className="material-symbols-outlined text-[20px]">{showForgotPass ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="fp-confirm-password" className="text-label-md text-on-surface-variant">{{ vi: 'Xác nhận mật khẩu mới', en: 'Confirm New Password' }[locale]}</label>
                    <input
                      id="fp-confirm-password"
                      name="confirmNewPassword"
                      type={showForgotPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={forgotConfirmPass}
                      onChange={(e) => { setForgotConfirmPass(e.target.value); setFpError(''); }}
                      placeholder="••••••••"
                      aria-invalid={fpError ? 'true' : undefined}
                      className="w-full px-3 py-2.5 border border-border-light rounded-lg text-body-md text-on-surface bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-outline"
                    />
                  </div>

                  {fpError && (
                    <div role="alert" className="bg-red-50 border-l-4 border-danger p-3 rounded">
                      <p className="text-body-sm text-red-800">{fpError}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-body-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? ({ vi: 'Đang xử lý...', en: 'Processing...' })[locale] : ({ vi: 'Đặt lại mật khẩu', en: 'Reset Password' }[locale])}
                  </button>
                </form>
              )}

              {forgotStep === 'done' && (
                <div className="space-y-5">
                  <div role="status" className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                    <p className="text-body-sm text-green-800">{fpSuccess}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="w-full bg-primary text-white font-bold py-2.5 rounded-lg text-body-md hover:bg-primary-container transition-colors"
                  >
                    {{ vi: 'Về trang đăng nhập', en: 'Back to Login' }[locale]}
                  </button>
                </div>
              )}
            </div>
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

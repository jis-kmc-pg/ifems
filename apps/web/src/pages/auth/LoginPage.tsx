import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_NAME, APP_SUBTITLE } from '../../lib/constants';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 600));

    // 목업 인증 (admin/admin)
    if ((id === 'admin' || id === 'manager') && pw === 'admin') {
      login({ id, name: id === 'admin' ? '시스템 관리자' : '설비 담당자', role: id === 'admin' ? 'ADMIN' : 'MANAGER', department: '생산기술팀' });
      navigate('/');
    } else {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#E94560] flex items-center justify-center p-4">
      {/* 배경 패턴 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#27AE60]/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#27AE60]/5" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#27AE60] rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-bold text-xl">i-F</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
          <p className="text-white/50 text-sm mt-1">{APP_SUBTITLE}</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1.5">아이디</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-10 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#27AE60] focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-[#27AE60]/20 border border-[#27AE60]/30 rounded-lg px-4 py-2.5 text-sm text-[#27AE60]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#27AE60] hover:bg-[#C73B52] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/30 text-center">
              테스트 계정: admin / admin
            </p>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-4">
          © 2026 화성 PT4공장. Powered by i-FEMS.
        </p>
      </div>
    </div>
  );
}

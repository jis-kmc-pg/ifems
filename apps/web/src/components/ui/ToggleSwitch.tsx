// ============================================================
// 토글 스위치 공통 컴포넌트
// SET-001~006 등 설정 페이지에서 활성화/비활성화 토글에 사용
// ============================================================

interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function ToggleSwitch({ value, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors focus:outline-none ${
        value ? 'bg-[#E94560] hover:bg-[#C73B52]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${
        value ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

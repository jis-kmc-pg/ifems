import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';

// HMGMA Slide 21 — RTU Control Settings (월간 캘린더 + 알고리즘 등록)

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SET021RTUSchedule() {
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(10);

  // 10월 캘린더 셀 (간단한 6주 × 7일 그리드)
  const cells: Array<{ day: number; offset?: boolean; rtuControl?: boolean }> = [];
  // 9월 29(일) ~ 11월 9(토) (slide 21의 캘린더와 동일)
  const startOffset = 29;
  for (let i = 0; i < 2; i++) cells.push({ day: startOffset + i, offset: true, rtuControl: true });
  for (let d = 1; d <= 31; d++) {
    const matchDay = [4,7,11,14,18,21,25,28].includes(d);
    cells.push({ day: d, rtuControl: matchDay });
  }
  for (let i = 1; cells.length < 42; i++) cells.push({ day: i, offset: true, rtuControl: i <= 9 && [1,4,8].includes(i) });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="RTU 운전 스케줄 (SET-021)"
        description="HMGMA Slide 21 — 월간 알고리즘 적용 캘린더 + 등록/수정"
        breadcrumbs={[{ label: '설정' }, { label: '부대설비' }, { label: 'RTU 스케줄' }]}
      />

      <div className="bg-[#FDB813]/10 border border-[#FDB813]/30 rounded-lg p-3 mb-3">
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle size={14} className="text-[#FDB813] mt-0.5 flex-shrink-0" />
          <span>
            현재 골격 화면. 실제 동작은 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">fems.schedule_rules</code> 활용 (HVAC 타입 룰 + condition JSONB로 Algorithm Settings 저장)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* 좌측 — 월간 캘린더 */}
        <div className="lg:col-span-2 bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-sm font-semibold mb-2">Monthly Algorithm Setting Schedule</div>
          <div className="flex items-center justify-center gap-2 mb-2 text-sm">
            <button onClick={() => setMonth(m => m === 1 ? 12 : m-1)} className="px-2">&lt;</button>
            <span className="font-bold">{year} / {String(month).padStart(2,'0')}</span>
            <button onClick={() => setMonth(m => m === 12 ? 1 : m+1)} className="px-2">&gt;</button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 text-xs">
            {DAYS.map((d, i) => (
              <div key={d} className={`bg-white dark:bg-[#16213E] p-1.5 text-center font-semibold ${i === 0 ? 'text-[#E94560]' : i === 6 ? 'text-[#3B82F6]' : 'text-gray-700 dark:text-gray-200'}`}>
                {d}
              </div>
            ))}
            {cells.map((c, i) => (
              <div
                key={i}
                className={`bg-white dark:bg-[#16213E] p-1 min-h-[56px] ${c.offset ? 'text-gray-300 dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'}`}
              >
                <div className="text-[11px]">{c.day}</div>
                {c.rtuControl && (
                  <div className="mt-0.5 text-[9px] bg-[#3B82F6] text-white rounded px-1 py-0.5 text-center">
                    RTU Control
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 우측 — Register/Modify */}
        <div className="bg-white dark:bg-[#16213E] border border-gray-200 dark:border-gray-700 rounded-lg p-3 self-start">
          <div className="text-sm font-semibold bg-[#1A1A2E] text-white px-3 py-2 -mx-3 -mt-3 mb-3 rounded-t-lg">
            Register/Modify Algorithm Information
          </div>
          <div className="space-y-2 text-xs">
            <Field label="Schedule Name" v="RTU Control" />
            <Field label="Group" v="Press_Section_1" />
            <Field label="Algorithm Settings" v="Optimum" />
            <Field label="Period" v="2024-09-29 ~ 2024-11-09" />
            <div>
              <div className="text-gray-500 mb-1">Days Excluded Operation</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat','Holiday'].map(d => (
                  <label key={d} className="flex items-center gap-1">
                    <input type="checkbox" defaultChecked={['Mon','Fri'].includes(d)} /> {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="ON Time" v="00 : 00" />
              <Field label="OFF Time" v="00 : 00" />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
              <div className="text-gray-500 mb-1">RTU List (Total 1)</div>
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr><th className="p-1">No</th><th className="p-1">SHOP</th><th className="p-1">RTU</th></tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <td className="p-1 text-center">1</td>
                    <td className="p-1 text-center">Press</td>
                    <td className="p-1 text-center font-mono">press_rtu_1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-1 pt-2">
              <button className="px-2 py-1 border rounded">New</button>
              <button className="px-2 py-1 border rounded">Delete</button>
              <button className="px-2 py-1 bg-[#3B82F6] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-gray-500 mb-0.5">{label}</div>
      <div className="px-2 py-1 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600 font-mono">{v}</div>
    </div>
  );
}

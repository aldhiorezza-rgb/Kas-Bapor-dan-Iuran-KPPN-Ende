'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, ExternalLink, Settings } from 'lucide-react';

export default function Dashboard() {
  const [period, setPeriod] = useState('2026-09');
  const [deductions, setDeductions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [mutations, setMutations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    // 1. Data Potongan Pegawai
    const { data: dedData } = await supabase
      .from('monthly_deductions')
      .select('*, employees(name)')
      .eq('period', period);
    setDeductions(dedData || []);

    // 2. Data Bukti Setor DASOS & Rumdin
    const { data: subData } = await supabase
      .from('monthly_submissions')
      .select('*')
      .eq('period', period);
    setSubmissions(subData || []);

    // 3. Mutasi Kas Bapor
    const { data: baporData } = await supabase
      .from('bapor_transactions')
      .select('*')
      .order('date', { ascending: true });
    setMutations(baporData || []);

    setLoading(false);
  };

  const dasosSub = submissions.find((s) => s.category === 'DASOS');
  const rumdinSub = submissions.find((s) => s.category === 'RUMDIN');

  // Hitung Saldo Berjalan Kas Bapor
  let runningBalance = 0;
  const mutationsWithBalance = mutations.map((item) => {
    if (item.type === 'IN') runningBalance += Number(item.amount);
    else runningBalance -= Number(item.amount);
    return { ...item, currentBalance: runningBalance };
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Laporan Kas Kecil & Iuran Pegawai</h1>
            <p className="text-blue-200 text-sm">KPPN Ende - Transparansi & Monitoring Real-Time</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">Periode:</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-blue-800 text-white font-medium px-3 py-1.5 rounded-lg border border-blue-600 focus:outline-none"
            />
            {/* Tombol Modul Admin */}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 bg-white text-blue-900 text-xs font-semibold px-3 py-2 rounded-lg shadow hover:bg-blue-50 transition"
            >
              <Settings size={14} />
              Modul Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        {/* Metric / Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card DASOS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Setoran DASOS</span>
            {dasosSub ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 size={20} />
                  <span>Sudah Disetor ke Pusat</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Rp {Number(dasosSub.total_amount).toLocaleString('id-ID')}</p>
                <a
                  href={dasosSub.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink size={14} /> Lihat Bukti Setor
                </a>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-amber-600 font-medium text-sm">
                <Clock size={18} />
                <span>Menunggu Penyelesaian Setoran</span>
              </div>
            )}
          </div>

          {/* Card RUMDIN */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Iuran Rumdin</span>
            {rumdinSub ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 size={20} />
                  <span>Sudah Ditransfer ke PPNPN</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Rp {Number(rumdinSub.total_amount).toLocaleString('id-ID')}</p>
                <a
                  href={rumdinSub.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink size={14} /> Lihat Bukti Transfer
                </a>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-amber-600 font-medium text-sm">
                <Clock size={18} />
                <span>Pengumpulan Berjalan</span>
              </div>
            )}
          </div>

          {/* Card Saldo Kas Bapor */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Kas Bapor & Kesra</span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-800">
                Rp {runningBalance.toLocaleString('id-ID')}
              </span>
              <p className="text-xs text-slate-400 mt-1">Posisi saldo kas riil saat ini</p>
            </div>
          </div>
        </div>

        {/* Tabel Mutasi Kas Bapor */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Buku Kas Mutasi Bapor & Kesra</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
              {mutations.length} Transaksi
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Uraian / Transaksi</th>
                  <th className="py-3 px-4 text-right">Penerimaan (Rp)</th>
                  <th className="py-3 px-4 text-right">Pengeluaran (Rp)</th>
                  <th className="py-3 px-4 text-right">Saldo Kas (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mutationsWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada transaksi mutasi kas tercatat
                    </td>
                  </tr>
                ) : (
                  mutationsWithBalance.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-600">{row.date}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{row.description}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">
                        {row.type === 'IN' ? `Rp ${Number(row.amount).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-600">
                        {row.type === 'OUT' ? `Rp ${Number(row.amount).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-700">
                        Rp {row.currentBalance.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
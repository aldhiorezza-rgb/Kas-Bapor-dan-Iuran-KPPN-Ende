'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Plus, Check, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [period, setPeriod] = useState('2026-09');
  const [employees, setEmployees] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Form Transaksi Bapor
  const [baporDate, setBaporDate] = useState(new Date().toISOString().split('T')[0]);
  const [baporDesc, setBaporDesc] = useState('');
  const [baporType, setBaporType] = useState('OUT');
  const [baporAmount, setBaporAmount] = useState('');

  // State Form Tambah Pegawai
  const [newEmpName, setNewEmpName] = useState('');
  const [newDasos, setNewDasos] = useState('100000');
  const [newBapor, setNewBapor] = useState('50000');
  const [newRumdin, setNewRumdin] = useState('75000');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*').eq('is_active', true);
    setEmployees(emps || []);

    const { data: deds } = await supabase.from('monthly_deductions').select('*').eq('period', period);
    
    // Inisialisasi potongan bulan berjalan dari master pegawai jika belum ada
    if (emps && (!deds || deds.length === 0)) {
      const initData = emps.map((e) => ({
        period,
        employee_id: e.id,
        dasos_amount: e.default_dasos,
        bapor_kesra_amount: e.default_bapor_kesra,
        rumdin_amount: e.default_rumdin,
        is_paid: false,
      }));
      await supabase.from('monthly_deductions').insert(initData);
      const { data: reloadedDeds } = await supabase.from('monthly_deductions').select('*').eq('period', period);
      setDeductions(reloadedDeds || []);
    } else {
      setDeductions(deds || []);
    }

    const { data: subs } = await supabase.from('monthly_submissions').select('*').eq('period', period);
    setSubmissions(subs || []);
    setLoading(false);
  };

  const togglePaid = async (deductionId: string, currentStatus: boolean) => {
    await supabase
      .from('monthly_deductions')
      .update({ is_paid: !currentStatus, paid_at: !currentStatus ? new Date().toISOString() : null })
      .eq('id', deductionId);
    loadData();
  };

  const handleFileUpload = async (category: 'DASOS' | 'RUMDIN', file: File, total: number) => {
    const filePath = `${period}-${category}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('bukti-transaksi').upload(filePath, file);
    if (uploadErr) return alert('Gagal upload berkas: ' + uploadErr.message);

    const { data: urlData } = supabase.storage.from('bukti-transaksi').getPublicUrl(filePath);

    await supabase.from('monthly_submissions').upsert({
      period,
      category,
      total_amount: total,
      proof_url: urlData.publicUrl,
    });
    alert(`Bukti ${category} berhasil diunggah!`);
    loadData();
  };

  const handleAddBapor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baporDesc || !baporAmount) return;
    await supabase.from('bapor_transactions').insert({
      date: baporDate,
      description: baporDesc,
      type: baporType,
      amount: Number(baporAmount),
    });
    setBaporDesc('');
    setBaporAmount('');
    alert('Catatan kas tersimpan!');
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName) return;
    await supabase.from('employees').insert({
      name: newEmpName,
      default_dasos: Number(newDasos),
      default_bapor_kesra: Number(newBapor),
      default_rumdin: Number(newRumdin),
    });
    setNewEmpName('');
    loadData();
  };

  const allPaid = deductions.length > 0 && deductions.every((d) => d.is_paid);
  const totalDasos = deductions.reduce((acc, d) => acc + Number(d.dasos_amount), 0);
  const totalRumdin = deductions.reduce((acc, d) => acc + Number(d.rumdin_amount), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-slate-200 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Modul Administrasi Kas</h1>
              <p className="text-sm text-slate-500">Kelola setoran pegawai dan kas kantor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Periode:</span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="p-2 border rounded-lg font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Panel Aksi Penyetoran DASOS & RUMDIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Box DASOS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800">Penyetoran DASOS ke Pusat</h3>
            <p className="text-sm text-slate-500 mt-1">Total akumulasi: Rp {totalDasos.toLocaleString('id-ID')}</p>
            <div className="mt-4">
              {allPaid ? (
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg inline-flex items-center gap-2">
                  <Upload size={16} />
                  Upload Bukti Setor ke Pusat
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload('DASOS', e.target.files[0], totalDasos);
                    }}
                  />
                </label>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200 inline-block">
                  Tombol aktif otomatis jika semua pegawai sudah checklist setor.
                </span>
              )}
            </div>
          </div>

          {/* Box Rumdin */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800">Transfer Rumdin ke PPNPN</h3>
            <p className="text-sm text-slate-500 mt-1">Total terkumpul: Rp {totalRumdin.toLocaleString('id-ID')}</p>
            <div className="mt-4">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg inline-flex items-center gap-2">
                <Upload size={16} />
                Upload Bukti Transfer PPNPN
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload('RUMDIN', e.target.files[0], totalRumdin);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Tabel Checklist Potongan */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 mb-4">Checklist Potongan Pegawai ({period})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b">
                <tr>
                  <th className="py-2.5 px-3">Nama Pegawai</th>
                  <th className="py-2.5 px-3">DASOS</th>
                  <th className="py-2.5 px-3">Bapor & Kesra</th>
                  <th className="py-2.5 px-3">Rumdin</th>
                  <th className="py-2.5 px-3">Total Potongan</th>
                  <th className="py-2.5 px-3 text-center">Status Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deductions.map((d) => {
                  const emp = employees.find((e) => e.id === d.employee_id);
                  const total = Number(d.dasos_amount) + Number(d.bapor_kesra_amount) + Number(d.rumdin_amount);
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-800">{emp?.name || 'Pegawai'}</td>
                      <td className="py-2.5 px-3 text-slate-600">Rp {Number(d.dasos_amount).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 text-slate-600">Rp {Number(d.bapor_kesra_amount).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 text-slate-600">Rp {Number(d.rumdin_amount).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">Rp {total.toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => togglePaid(d.id, d.is_paid)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                            d.is_paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {d.is_paid ? '✓ Lunas' : 'Belum Setor'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Input Mutasi Kas Bapor & Tambah Pegawai */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Kas Bapor */}
          <form onSubmit={handleAddBapor} className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-800">Catat Pengeluaran / Pemasukan Bapor</h3>
            <div>
              <label className="text-xs text-slate-500">Tanggal Transaksi</label>
              <input
                type="date"
                value={baporDate}
                onChange={(e) => setBaporDate(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Uraian / Keterangan</label>
              <input
                type="text"
                placeholder="misal: Makan Jumat, Lapangan Badminton"
                value={baporDesc}
                onChange={(e) => setBaporDesc(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Jenis</label>
                <select
                  value={baporType}
                  onChange={(e) => setBaporType(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg text-sm"
                >
                  <option value="OUT">Pengeluaran (Kas Keluar)</option>
                  <option value="IN">Pemasukan (Kas Masuk)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={baporAmount}
                  onChange={(e) => setBaporAmount(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-sm transition">
              Simpan Mutasi Bapor
            </button>
          </form>

          {/* Form Tambah Pegawai */}
          <form onSubmit={handleAddEmployee} className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-800">Tambah Pegawai Baru</h3>
            <div>
              <label className="text-xs text-slate-500">Nama Lengkap</label>
              <input
                type="text"
                placeholder="Nama Pegawai"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-500">Default DASOS</label>
                <input
                  type="number"
                  value={newDasos}
                  onChange={(e) => setNewDasos(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Default Bapor</label>
                <input
                  type="number"
                  value={newBapor}
                  onChange={(e) => setNewBapor(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Default Rumdin</label>
                <input
                  type="number"
                  value={newRumdin}
                  onChange={(e) => setNewRumdin(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition">
              Simpan Master Pegawai
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, ArrowLeft, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [period, setPeriod] = useState('2026-09');
  const [employees, setEmployees] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State Mutasi Kas Bapor
  const [baporDate, setBaporDate] = useState('2026-09-03');
  const [baporDesc, setBaporDesc] = useState('');
  const [baporType, setBaporType] = useState('OUT');
  const [baporAmount, setBaporAmount] = useState('');

  // Form State Tambah Pegawai Baru
  const [newEmpName, setNewEmpName] = useState('');
  const [newDasos, setNewDasos] = useState('100000');
  const [newBapor, setNewBapor] = useState('50000');
  const [newRumdin, setNewRumdin] = useState('75000');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    // 1. Ambil daftar pegawai aktif
    const { data: emps, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (empErr) {
      console.error('Error fetching employees:', empErr);
    }
    setEmployees(emps || []);

    // 2. Ambil potongan di periode terpilih
    const { data: deds, error: dedErr } = await supabase
      .from('monthly_deductions')
      .select('*')
      .eq('period', period);

    if (dedErr) {
      console.error('Error fetching deductions:', dedErr);
    }

    // Jika pegawai ada tapi baris potongan bulan ini belum dibuat, buatkan otomatis
    if (emps && emps.length > 0 && (!deds || deds.length === 0)) {
      const initData = emps.map((e) => ({
        period,
        employee_id: e.id,
        dasos_amount: e.default_dasos,
        bapor_kesra_amount: e.default_bapor_kesra,
        rumdin_amount: e.default_rumdin,
        is_paid: false,
      }));

      await supabase.from('monthly_deductions').insert(initData);
      const { data: reloadedDeds } = await supabase
        .from('monthly_deductions')
        .select('*')
        .eq('period', period);
      setDeductions(reloadedDeds || []);
    } else {
      setDeductions(deds || []);
    }

    // 3. Ambil bukti setor eksternal (DASOS / Rumdin)
    const { data: subs } = await supabase
      .from('monthly_submissions')
      .select('*')
      .eq('period', period);
    setSubmissions(subs || []);

    setLoading(false);
  };

  // Toggle status checklist setor per pegawai
  const togglePaid = async (deductionId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from('monthly_deductions')
      .update({
        is_paid: nextStatus,
        paid_at: nextStatus ? new Date().toISOString() : null,
      })
      .eq('id', deductionId);

    if (!error) {
      setDeductions((prev) =>
        prev.map((d) => (d.id === deductionId ? { ...d, is_paid: nextStatus } : d))
      );
    }
  };

  // Upload berkas bukti transfer ke Supabase Storage
  const handleFileUpload = async (category: 'DASOS' | 'RUMDIN', file: File, total: number) => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${period}-${category}-${Date.now()}-${cleanFileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('bukti-transaksi')
      .upload(filePath, file);

    if (uploadErr) {
      alert('Gagal mengunggah berkas: ' + uploadErr.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('bukti-transaksi')
      .getPublicUrl(filePath);

    const { error: upsertErr } = await supabase
      .from('monthly_submissions')
      .upsert({
        period,
        category,
        total_amount: total,
        proof_url: urlData.publicUrl,
      });

    if (upsertErr) {
      alert('Gagal menyimpan referensi data: ' + upsertErr.message);
    } else {
      alert(`Bukti setoran ${category} berhasil disimpan!`);
      loadData();
    }
  };

  // Catat Mutasi Kas Bapor
  const handleAddBapor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baporDesc || !baporAmount) {
      alert('Harap isi uraian dan nominal transaksi!');
      return;
    }

    const { error } = await supabase.from('bapor_transactions').insert({
      date: baporDate,
      description: baporDesc,
      type: baporType,
      amount: Number(baporAmount),
    });

    if (error) {
      alert('Gagal mencatat mutasi: ' + error.message);
    } else {
      alert('Mutasi kas Bapor & Kesra berhasil dicatat!');
      setBaporDesc('');
      setBaporAmount('');
    }
  };

  // Tambah Pegawai Baru ke Master
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      alert('Nama pegawai tidak boleh kosong!');
      return;
    }

    const { data: newEmp, error } = await supabase
      .from('employees')
      .insert({
        name: newEmpName.trim(),
        default_dasos: Number(newDasos),
        default_bapor_kesra: Number(newBapor),
        default_rumdin: Number(newRumdin),
      })
      .select()
      .single();

    if (error) {
      alert('Gagal menambah pegawai: ' + error.message);
    } else {
      // Masukkan langsung baris tagihan potongan bulan berjalan
      if (newEmp) {
        await supabase.from('monthly_deductions').insert({
          period,
          employee_id: newEmp.id,
          dasos_amount: Number(newDasos),
          bapor_kesra_amount: Number(newBapor),
          rumdin_amount: Number(newRumdin),
          is_paid: false,
        });
      }
      setNewEmpName('');
      alert('Pegawai baru berhasil ditambahkan!');
      loadData();
    }
  };

  // Hapus / Nonaktifkan Pegawai
  const handleDeleteEmployee = async (empId: string, empName: string) => {
    if (!confirm(`Hapus pegawai "${empName}" dari daftar master?`)) return;

    const { error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', empId);

    if (error) {
      alert('Gagal menghapus pegawai: ' + error.message);
    } else {
      // Hapus tagihan bulanan pegawai tersebut untuk periode aktif
      await supabase
        .from('monthly_deductions')
        .delete()
        .eq('employee_id', empId)
        .eq('period', period);
      loadData();
    }
  };

  const allPaid = deductions.length > 0 && deductions.every((d) => d.is_paid);
  const totalDasos = deductions.reduce((acc, d) => acc + Number(d.dasos_amount), 0);
  const totalRumdin = deductions.reduce((acc, d) => acc + Number(d.rumdin_amount), 0);

  const dasosSub = submissions.find((s) => s.category === 'DASOS');
  const rumdinSub = submissions.find((s) => s.category === 'RUMDIN');

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Admin */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Kembali ke Dashboard Publik"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Modul Administrasi Kas</h1>
              <p className="text-sm text-slate-500">
                Pengelolaan checklist potongan bulanan dan mutasi kas kecil
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Periode:
            </span>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-white text-slate-900 font-semibold px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Panel Aksi Penyetoran DASOS & RUMDIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Eksekusi DASOS */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Penyetoran DASOS ke Pusat</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target setor:{' '}
                    <span className="font-bold text-slate-800">
                      Rp {totalDasos.toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>
                {dasosSub && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={13} /> Terkirim ke Pusat
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5">
              {dasosSub ? (
                <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span>Bukti setor telah diunggah.</span>
                  <a
                    href={dasosSub.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Buka Berkas
                  </a>
                </div>
              ) : allPaid ? (
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 w-full transition shadow-sm">
                  <Upload size={16} />
                  Unggah Bukti Setor ke Kantor Pusat
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload('DASOS', e.target.files[0], totalDasos);
                      }
                    }}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <AlertCircle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    Tombol unggah aktif otomatis setelah <b>seluruh pegawai</b> ditandai lunas.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card Eksekusi RUMDIN */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Transfer Rumdin ke PPNPN</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target transfer:{' '}
                    <span className="font-bold text-slate-800">
                      Rp {totalRumdin.toLocaleString('id-ID')}
                    </span>
                  </p>
                </div>
                {rumdinSub && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={13} /> Ditransfer ke PPNPN
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5">
              {rumdinSub ? (
                <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span>Bukti transfer telah diunggah.</span>
                  <a
                    href={rumdinSub.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Buka Berkas
                  </a>
                </div>
              ) : (
                <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 w-full transition shadow-sm">
                  <Upload size={16} />
                  Unggah Bukti Transfer ke PPNPN
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload('RUMDIN', e.target.files[0], totalRumdin);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Checklist Potongan Pegawai */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Checklist Potongan Pegawai ({period})
              </h2>
              <p className="text-xs text-slate-500">
                Klik tombol status pada setiap baris untuk menandai pegawai yang telah melunasi
                potongan
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700 bg-slate-200 px-3 py-1 rounded-full">
              {deductions.filter((d) => d.is_paid).length} / {deductions.length} Lunas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Pegawai</th>
                  <th className="py-3 px-4">DASOS</th>
                  <th className="py-3 px-4">Bapor & Kesra</th>
                  <th className="py-3 px-4">Rumdin</th>
                  <th className="py-3 px-4 font-bold">Total</th>
                  <th className="py-3 px-4 text-center">Status Setor</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Memuat daftar potongan pegawai...
                    </td>
                  </tr>
                ) : deductions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada data pegawai. Silakan tambah nama pegawai di formulir bawah.
                    </td>
                  </tr>
                ) : (
                  deductions.map((d) => {
                    const emp = employees.find((e) => e.id === d.employee_id);
                    const total =
                      Number(d.dasos_amount) +
                      Number(d.bapor_kesra_amount) +
                      Number(d.rumdin_amount);

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {emp?.name || 'Pegawai'}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          Rp {Number(d.dasos_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          Rp {Number(d.bapor_kesra_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          Rp {Number(d.rumdin_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          Rp {total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => togglePaid(d.id, d.is_paid)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
                              d.is_paid
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                            }`}
                          >
                            {d.is_paid ? '✓ Lunas' : 'Belum Setor'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {emp && (
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition"
                              title="Hapus / Nonaktifkan Pegawai"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Input Mutasi Kas Bapor & Tambah Pegawai Baru */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Mutasi Kas Bapor */}
          <form
            onSubmit={handleAddBapor}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Catat Mutasi Kas Bapor & Kesra</h3>
              <p className="text-xs text-slate-500">
                Pencatatan pengeluaran harian atau pemasukan tambahan kas kecil
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Tanggal Transaksi</label>
              <input
                type="date"
                value={baporDate}
                onChange={(e) => setBaporDate(e.target.value)}
                className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Uraian / Keterangan</label>
              <input
                type="text"
                placeholder="Contoh: Makan Jumat, Shuttlecock Badminton, dll"
                value={baporDesc}
                onChange={(e) => setBaporDesc(e.target.value)}
                className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Jenis Transaksi</label>
                <select
                  value={baporType}
                  onChange={(e) => setBaporType(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="OUT">Pengeluaran (Kas Keluar)</option>
                  <option value="IN">Pemasukan (Kas Masuk)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Nominal (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 150000"
                  value={baporAmount}
                  onChange={(e) => setBaporAmount(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-sm"
            >
              Simpan Mutasi Kas
            </button>
          </form>

          {/* Form Tambah Pegawai Baru */}
          <form
            onSubmit={handleAddEmployee}
            className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Pegawai Baru</h3>
              <p className="text-xs text-slate-500">
                Data master pegawai dan pengaturan default nominal iuran
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Nama Lengkap Pegawai</label>
              <input
                type="text"
                placeholder="Ketik nama lengkap pegawai..."
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">DASOS (Rp)</label>
                <input
                  type="number"
                  value={newDasos}
                  onChange={(e) => setNewDasos(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Bapor (Rp)</label>
                <input
                  type="number"
                  value={newBapor}
                  onChange={(e) => setNewBapor(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Rumdin (Rp)</label>
                <input
                  type="number"
                  value={newRumdin}
                  onChange={(e) => setNewRumdin(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-sm"
            >
              Simpan Master Pegawai
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
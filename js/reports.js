/**
 * LAK Puskesmas - Reports Module
 * Handles monthly report generation, display, and printing
 */

const Reports = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,

    // ========================================
    // Initialization
    // ========================================

    init() {
        this.setupEventListeners();
        this.setDefaultPeriod();
    },

    setupEventListeners() {
        document.getElementById('generate-report')?.addEventListener('click', () => {
            this.generateReport();
        });

        document.getElementById('export-excel')?.addEventListener('click', () => {
            this.exportReport();
        });

        document.getElementById('print-report')?.addEventListener('click', () => {
            this.printReport();
        });
    },

    setDefaultPeriod() {
        const monthSelect = document.getElementById('report-month');
        const yearSelect = document.getElementById('report-year');

        if (monthSelect) monthSelect.value = this.currentMonth;
        if (yearSelect) yearSelect.value = this.currentYear;
    },

    // ========================================
    // Report Generation
    // ========================================

    generateReport() {
        this.currentMonth = parseInt(document.getElementById('report-month').value);
        this.currentYear = parseInt(document.getElementById('report-year').value);

        const activities = Storage.getActivitiesForMonth(this.currentYear, this.currentMonth);
        this.renderReportTable(activities);
    },

    renderReportTable(activities) {
        const container = document.getElementById('report-table-container');
        if (!container) return;

        const sortedDates = Object.keys(activities).sort();

        if (sortedDates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📊</span>
                    <p>Tidak ada data untuk periode ini</p>
                </div>
            `;
            return;
        }

        let totalMenit = 0;
        let totalPasienUmum = 0;
        let totalPasienRujukan = 0;
        let totalPasienKhusus = 0;

        let tableHtml = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Hari</th>
                        <th>Tanggal</th>
                        <th>Jam</th>
                        <th>Kegiatan</th>
                        <th>Menit</th>
                        <th>Total Hari</th>
                        <th>Pasien</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedDates.forEach((dateStr, dayIdx) => {
            const day = activities[dateStr];
            const date = new Date(dateStr);
            const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

            totalMenit += day.totalMenit || 0;
            totalPasienUmum += day.pasienUmum || 0;
            totalPasienRujukan += day.pasienRujukan || 0;
            totalPasienKhusus += day.pasienKhusus || 0;

            day.activities.forEach((act, actIdx) => {
                tableHtml += `<tr>`;

                if (actIdx === 0) {
                    tableHtml += `
                        <td rowspan="${day.activities.length}">${dayIdx + 1}</td>
                        <td rowspan="${day.activities.length}">${day.hari}</td>
                        <td rowspan="${day.activities.length}">${formattedDate}</td>
                    `;
                }

                tableHtml += `
                    <td>${act.jamMulai} - ${act.jamSelesai}</td>
                    <td>${act.kegiatan}</td>
                    <td>${act.menit}</td>
                `;

                if (actIdx === 0) {
                    const totalPatients = (day.pasienUmum || 0) + (day.pasienRujukan || 0) + (day.pasienKhusus || 0);
                    tableHtml += `
                        <td rowspan="${day.activities.length}" style="font-weight: 600; color: var(--accent-blue);">${day.totalMenit}</td>
                        <td rowspan="${day.activities.length}">${totalPatients}</td>
                    `;
                }

                tableHtml += `</tr>`;
            });
        });

        // Total row
        const totalPatients = totalPasienUmum + totalPasienRujukan + totalPasienKhusus;
        tableHtml += `
            <tr class="total-row">
                <td colspan="5" style="text-align: right;">TOTAL:</td>
                <td>-</td>
                <td style="color: var(--accent-green);">${totalMenit}</td>
                <td style="color: var(--accent-purple);">${totalPatients}</td>
            </tr>
        `;

        tableHtml += `</tbody></table>`;

        // Summary cards
        const summaryHtml = `
            <div class="report-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card gradient-blue" style="padding: 16px;">
                    <div class="stat-info">
                        <span class="stat-value" style="font-size: 24px;">${sortedDates.length}</span>
                        <span class="stat-label">Hari Kerja</span>
                    </div>
                </div>
                <div class="stat-card gradient-purple" style="padding: 16px;">
                    <div class="stat-info">
                        <span class="stat-value" style="font-size: 24px;">${totalMenit}</span>
                        <span class="stat-label">Total Menit</span>
                    </div>
                </div>
                <div class="stat-card gradient-green" style="padding: 16px;">
                    <div class="stat-info">
                        <span class="stat-value" style="font-size: 24px;">${Math.round(totalMenit / 60)}</span>
                        <span class="stat-label">Total Jam</span>
                    </div>
                </div>
                <div class="stat-card gradient-orange" style="padding: 16px;">
                    <div class="stat-info">
                        <span class="stat-value" style="font-size: 24px;">${totalPatients}</span>
                        <span class="stat-label">Total Pasien</span>
                    </div>
                </div>
            </div>
            <div style="margin-bottom: 16px; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
                <span style="color: var(--text-secondary);">Detail Pasien:</span>
                <span style="margin-left: 16px;">Umum: <strong>${totalPasienUmum}</strong></span>
                <span style="margin-left: 16px;">Rujukan: <strong>${totalPasienRujukan}</strong></span>
                <span style="margin-left: 16px;">Khusus: <strong>${totalPasienKhusus}</strong></span>
            </div>
        `;

        container.innerHTML = summaryHtml + tableHtml;
    },

    // ========================================
    // Print Report
    // ========================================

    printReport() {
        const month = parseInt(document.getElementById('report-month').value);
        const year = parseInt(document.getElementById('report-year').value);

        const activities = Storage.getActivitiesForMonth(year, month);

        if (Object.keys(activities).length === 0) {
            App.showToast('Tidak ada data untuk dicetak', 'warning');
            return;
        }

        const profile = Storage.getProfile();
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const printContent = this.generatePrintHTML(activities, profile, monthNames[month - 1], year);

        // Open print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    },

    generatePrintHTML(activities, profile, monthName, year) {
        const sortedDates = Object.keys(activities).sort();
        const totalDays = sortedDates.length;

        let totalMenit = 0;
        let tableRows = '';
        let dayNumber = 1;
        let sickLeaveDays = 0;
        let holidayDays = 0;

        sortedDates.forEach((dateStr) => {
            const day = activities[dateStr];
            const date = new Date(dateStr);
            const dayOfMonth = date.getDate();
            const formattedDate = `${day.hari}, ${String(dayOfMonth).padStart(2, '0')} ${monthName} ${year}`;

            totalMenit += day.totalMenit || 0;
            const totalPatients = (day.pasienUmum || 0) + (day.pasienRujukan || 0) + (day.pasienKhusus || 0);

            // Count sick leave and holiday days
            if (day.isSickLeave) sickLeaveDays++;
            if (day.isNationalHoliday) holidayDays++;

            day.activities.forEach((act, actIdx) => {
                const isFirst = actIdx === 0;
                const rowspan = day.activities.length + 1; // +1 for total row

                tableRows += `<tr>`;

                if (isFirst) {
                    tableRows += `<td rowspan="${rowspan}" class="cell-center">${dayNumber}</td>`;
                    tableRows += `<td rowspan="${rowspan}" class="cell-left">${formattedDate}</td>`;
                }

                tableRows += `<td class="cell-center">${act.jamMulai} - ${act.jamSelesai}</td>`;
                tableRows += `<td class="cell-left">${act.kegiatan}</td>`;
                tableRows += `<td class="cell-center">1 kegiatan</td>`;
                tableRows += `<td class="cell-center">${act.menit}</td>`;
                tableRows += `<td class="cell-center">${day.keterangan || 'TJ'}</td>`;
                tableRows += `<td class="cell-center"></td>`;
                tableRows += `</tr>`;
            });

            // Daily total row - aligned with columns (NO and HARI are rowspan, so we have 6 columns left)
            tableRows += `
                <tr class="total-daily-row">
                    <td colspan="2" class="cell-right"><strong>Total Aktivitas Harian (menit)</strong></td>
                    <td class="cell-center"></td>
                    <td class="cell-center total-daily-value">${day.totalMenit}</td>
                    <td class="cell-center"></td>
                    <td class="cell-center"></td>
                </tr>
            `;

            dayNumber++;
        });

        // Calculate effective working days and percentage
        const leaveDays = sickLeaveDays + holidayDays;
        const effectiveDays = totalDays - leaveDays;
        const percentage = totalDays > 0 ? ((effectiveDays / totalDays) * 100).toFixed(1) : 100;

        return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Aktivitas Kerja - ${monthName} ${year}</title>
    <style>
        /* Page setup for F4 Portrait */
        @page {
            size: 215.9mm 330.2mm; /* F4 paper size */
            margin: 15mm 15mm 15mm 15mm;
        }
        
        @media print {
            html, body {
                width: 215.9mm;
                height: 330.2mm;
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            padding: 20px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        
        .print-container {
            max-width: 100%;
            margin: 0 auto;
        }
        
        /* Header */
        .header-title {
            text-align: center;
            background: #00B0F0;
            color: #000;
            font-weight: bold;
            padding: 8px;
            font-size: 14px;
        }
        
        .header-subtitle {
            text-align: center;
            background: #00B0F0;
            color: #000;
            font-weight: bold;
            padding: 6px;
            font-size: 12px;
            border-top: 1px solid #000;
        }
        
        /* Profile Section */
        .profile-section {
            margin: 10px 0;
            border: 1px solid #000;
        }
        
        .profile-header {
            background: #00B0F0;
            padding: 4px 8px;
            font-weight: bold;
            text-align: center;
        }
        
        .profile-row {
            display: flex;
            border-bottom: 1px solid #ccc;
        }
        
        .profile-row:last-child {
            border-bottom: none;
        }
        
        .profile-label {
            width: 30px;
            padding: 3px 8px;
            background: #f0f0f0;
            border-right: 1px solid #ccc;
            text-align: center;
        }
        
        .profile-field {
            width: 100px;
            padding: 3px 8px;
            border-right: 1px solid #ccc;
        }
        
        .profile-value {
            flex: 1;
            padding: 3px 8px;
        }
        
        /* Period Info */
        .period-info {
            display: flex;
            justify-content: space-between;
            margin: 15px 0;
            font-weight: bold;
        }
        
        /* Main Table */
        .main-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .main-table th,
        .main-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: middle;
        }
        
        .main-table thead th {
            background: #00B0F0;
            color: #000;
            font-weight: bold;
            text-align: center;
        }
        
        .main-table thead tr:first-child th {
            background: #00B0F0;
        }
        
        .cell-center {
            text-align: center;
        }
        
        .cell-left {
            text-align: left;
        }
        
        .cell-right {
            text-align: right;
        }
        
        /* Daily Total Row */
        .total-daily-row {
            background: #B4E5F7;
        }
        
        .total-daily-row td {
            font-weight: bold;
        }
        
        .total-daily-value {
            background: #B4E5F7;
            font-weight: bold;
        }
        
        .passengers-badge {
            background: #FFC7CE;
            font-weight: bold;
        }
        
        /* Column widths */
        .col-no { width: 30px; }
        .col-hari { width: 130px; }
        .col-jam { width: 90px; }
        .col-kegiatan { width: auto; }
        .col-volume { width: 80px; }
        .col-menit { width: 60px; }
        .col-ket { width: 40px; }
        .col-paraf { width: 60px; }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }
            
            body {
                padding: 10px;
                font-size: 10px;
            }
            
            .header-title, .header-subtitle, .profile-header {
                background: #00B0F0 !important;
                -webkit-print-color-adjust: exact !important;
            }
            
            .main-table thead th {
                background: #00B0F0 !important;
            }
            
            .total-daily-row, .total-daily-row td {
                background: #B4E5F7 !important;
            }
            
            .passengers-badge {
                background: #B4E5F7 !important;
            }
            
            .main-table th,
            .main-table td {
                padding: 3px 4px;
            }
            
            @page {
                size: portrait;
                margin: 10mm;
            }
        }
    </style>
</head>
<body>
    <div class="print-container">
        <!-- Header -->
        <div class="header-title">REKAPITULASI</div>
        <div class="header-subtitle">LAPORAN AKTIVITAS KERJA</div>
        
        <!-- Profile Section -->
        <div class="profile-section">
            <div class="profile-header">DATA PEGAWAI</div>
            <div class="profile-row">
                <div class="profile-label">1</div>
                <div class="profile-field">Nama</div>
                <div class="profile-value">${profile.nama || 'Tresna Sary Winingsih, A.Md.Kep'}</div>
            </div>
            <div class="profile-row">
                <div class="profile-label">2</div>
                <div class="profile-field">NIP</div>
                <div class="profile-value">${profile.nip || '199702052025212002'}</div>
            </div>
            <div class="profile-row">
                <div class="profile-label">3</div>
                <div class="profile-field">Pangkat/ Gol</div>
                <div class="profile-value">${profile.pangkat ? profile.pangkat.split('/')[0].trim() : 'VII'}</div>
            </div>
            <div class="profile-row">
                <div class="profile-label">4</div>
                <div class="profile-field">Jabatan</div>
                <div class="profile-value">${profile.pangkat ? profile.pangkat.split('/')[1]?.trim() : 'Perawat Terampil'}</div>
            </div>
            <div class="profile-row">
                <div class="profile-label">5</div>
                <div class="profile-field">Unit Kerja</div>
                <div class="profile-value">${profile.unit || 'UPTD Puskesmas Tanjungwangi'}</div>
            </div>
        </div>
        
        <!-- Period Info -->
        <div class="period-info">
            <span>KEGIATAN BULAN : ${monthName} ${year}</span>
            <span>Jml Hari Kerja : ${totalDays}</span>
        </div>
        
        <!-- Main Table -->
        <table class="main-table">
            <thead>
                <tr>
                    <th class="col-no" rowspan="2">NO.</th>
                    <th class="col-hari" rowspan="2">HARI/ TANGGAL</th>
                    <th class="col-jam" rowspan="2">JAM</th>
                    <th class="col-kegiatan" rowspan="2">URAIAN KEGIATAN</th>
                    <th class="col-volume" rowspan="2">VOLUME<br>KEGIATAN</th>
                    <th class="col-menit" rowspan="2">JML<br>MENIT</th>
                    <th class="col-ket" rowspan="2">KET</th>
                    <th class="col-paraf" rowspan="2">PARAF<br>ATASAN</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        
        <!-- Footer Summary Table -->
        <table class="summary-table" style="margin-top: 20px; margin-left: auto; border-collapse: collapse;">
            <tr>
                <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">Total Aktivitas Tugas Jabatan perbulan (menit)</td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: right; font-weight: bold;">${totalMenit}</td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: center; font-weight: bold; color: #000;">100,0%</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 6px 12px;">Total Aktivitas Tugas Tambahan perbulan (menit)</td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: right;">0</td>
                <td style="border: 1px solid #000; padding: 6px 12px;"></td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">Total Aktivitas Perbulan (menit)</td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: right; font-weight: bold;">${totalMenit}</td>
                <td style="border: 1px solid #000; padding: 6px 12px;"></td>
            </tr>
            ${leaveDays > 0 ? `
            <tr>
                <td style="border: 1px solid #000; padding: 6px 12px; color: #000;">Hari Tidak Efektif (Izin Sakit: ${sickLeaveDays}, Libur Nasional: ${holidayDays})</td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: right; color: #000;">${leaveDays} hari</td>
                <td style="border: 1px solid #000; padding: 6px 12px;"></td>
            </tr>
            ` : ''}
            <tr>
                <td style="border: 1px solid #000; padding: 6px 12px; font-weight: bold;">Capaian Prestasi Kerja</td>
                <td style="border: 1px solid #000; padding: 6px 12px;"></td>
                <td style="border: 1px solid #000; padding: 6px 12px; text-align: center; font-weight: bold; font-size: 16px; color: #000;">${percentage}%</td>
            </tr>
        </table>
        
        <!-- Signature Section -->
        <div class="signature-section" style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 20px;">
            <div class="signature-left" style="text-align: center;">
                <p style="margin-bottom: 8px;">Mengetahui</p>
                <p style="font-weight: bold; margin-bottom: 60px;">kepala UPTD Puskesmas Tanjungwangi</p>
                <p style="font-weight: bold; text-decoration: underline;">Ita Fitrotuzzaqiyah, S.KM, M.K.M</p>
                <p>NIP. 19730416 199503 2 003</p>
            </div>
            <div class="signature-right" style="text-align: center;">
                <p style="margin-bottom: 8px;">&nbsp;</p>
                <p style="font-weight: bold; margin-bottom: 60px;">ASN Yang dinilai</p>
                <p style="font-weight: bold; text-decoration: underline;">${profile.nama || 'Tresna Sary Winingsih, A.Md.Kep'}</p>
                <p>NIP. ${profile.nip || '199702052025212002'}</p>
            </div>
        </div>
        
        <!-- Petunjuk Section -->
        <div class="petunjuk-section" style="margin-top: 40px; font-size: 11px;">
            <p style="font-weight: bold; margin-bottom: 8px;">Petunjuk :</p>
            <ol style="margin-left: 20px; line-height: 1.6;">
                <li>Kolom 1 : diisi dengan nomor urut hari efektif kerja</li>
                <li>Kolom 2 : diisi dengan hari dan tanggal kegiatan</li>
                <li>Kolom 3 : diisi dengan jam kegiatan (dari jam s/d jam {jj.mm - jj.mm})</li>
                <li>Kolom 4 : diisi dengan uraian kegiatan</li>
                <li>Kolom 5 : diisi dengan jumlah Volume kegiatan</li>
                <li>Kolom 6 : diisi dengan jumlah menit aktivitas</li>
                <li>Kolom 7 : diisi dengan TJ (tugas jabatan atau sesuai SKP), TT (tugas tambahan atau tidak sesuai dengan tugas jabatan/SKP)</li>
                <li>Kolom 8 : diisi dengan paraf (validasi) atasan</li>
            </ol>
        </div>
    </div>
</body>
</html>
        `;
    },

    // ========================================
    // Export
    // ========================================

    exportReport() {
        const month = parseInt(document.getElementById('report-month').value);
        const year = parseInt(document.getElementById('report-year').value);

        const activities = Storage.getActivitiesForMonth(year, month);

        if (Object.keys(activities).length === 0) {
            App.showToast('Tidak ada data untuk diexport', 'warning');
            return;
        }

        try {
            const fileName = ExcelHandler.exportToExcel(year, month);
            App.showToast(`File ${fileName} berhasil dibuat`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            App.showToast('Gagal mengexport: ' + error.message, 'error');
        }
    },

    // ========================================
    // Dashboard Integration
    // ========================================

    getRecentActivities(limit = 5) {
        const activities = Storage.getActivities();
        const allDays = Object.entries(activities)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, limit);

        return allDays.map(([dateStr, day]) => ({
            date: dateStr,
            hari: day.hari,
            totalMenit: day.totalMenit,
            activityCount: day.activities.length,
            totalPatients: (day.pasienUmum || 0) + (day.pasienRujukan || 0) + (day.pasienKhusus || 0)
        }));
    },

    renderRecentActivities() {
        const container = document.getElementById('recent-activity-list');
        if (!container) return;

        const recentActivities = this.getRecentActivities(5);

        if (recentActivities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>Belum ada aktivitas tercatat</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentActivities.map(act => {
            const date = new Date(act.date);
            const formattedDate = `${date.getDate()}/${date.getMonth() + 1}`;

            return `
                <div class="activity-item" data-date="${act.date}">
                    <div class="activity-info">
                        <span class="activity-date">${formattedDate} (${act.hari})</span>
                        <span class="activity-desc">${act.activityCount} kegiatan, ${act.totalPatients} pasien</span>
                        <span class="activity-duration">${act.totalMenit} menit</span>
                    </div>
                    <div class="activity-actions">
                        <button class="btn-edit-activity" onclick="Reports.editActivity('${act.date}')" title="Edit">✏️</button>
                        <button class="btn-delete-activity" onclick="Reports.deleteActivity('${act.date}')" title="Hapus">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    editActivity(dateStr) {
        // Navigate to daily input with the selected date
        DailyInput.currentDate = dateStr;
        App.navigateTo('daily-input');

        setTimeout(() => {
            DailyInput.updateDateDisplay();
            DailyInput.loadDataForDate();
        }, 100);
    },

    deleteActivity(dateStr) {
        const date = new Date(dateStr);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

        if (confirm(`Hapus data aktivitas tanggal ${formattedDate}?`)) {
            Storage.deleteDailyActivity(dateStr);
            App.showToast('Data berhasil dihapus', 'success');
            App.updateDashboard();
        }
    },

    renderMonthlyChart() {
        const container = document.getElementById('monthly-chart');
        if (!container) return;

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const stats = Storage.getMonthStats(currentYear, currentMonth);

        if (stats.totalDays === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <span>📊</span>
                    <p>Belum ada data bulan ini</p>
                </div>
            `;
            return;
        }

        const avgMinutesPerDay = Math.round(stats.totalMinutes / stats.totalDays);
        const avgPatientsPerDay = Math.round(stats.totalPatients / stats.totalDays);

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div style="text-align: center; padding: 20px; background: var(--glass-bg); border-radius: 12px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--accent-blue);">${avgMinutesPerDay}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Rata-rata Menit/Hari</div>
                </div>
                <div style="text-align: center; padding: 20px; background: var(--glass-bg); border-radius: 12px;">
                    <div style="font-size: 32px; font-weight: 700; color: var(--accent-purple);">${avgPatientsPerDay}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Rata-rata Pasien/Hari</div>
                </div>
            </div>
            <div style="margin-top: 16px; padding: 16px; background: var(--glass-bg); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: var(--text-secondary); font-size: 13px;">Progress Hari Kerja</span>
                    <span style="font-weight: 600;">${stats.totalDays} hari</span>
                </div>
                <div style="height: 8px; background: rgba(0,0,0,0.2); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${Math.min(100, (stats.totalDays / 22) * 100)}%; background: var(--gradient-green); border-radius: 4px;"></div>
                </div>
            </div>
        `;
    }
};

// Export for use in other modules
window.Reports = Reports;

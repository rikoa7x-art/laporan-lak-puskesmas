/**
 * LAK Puskesmas - Excel Handler Module
 * Handles import and export of Excel files using SheetJS
 */

const ExcelHandler = {
    // ========================================
    // Import Functions
    // ========================================

    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    // Find the LAK sheet
                    const lakSheet = this.findLAKSheet(workbook);
                    if (!lakSheet) {
                        reject(new Error('Tidak ditemukan sheet LAK yang valid'));
                        return;
                    }

                    // Parse the LAK data
                    const result = this.parseLAKSheet(workbook.Sheets[lakSheet]);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Gagal membaca file'));
            reader.readAsArrayBuffer(file);
        });
    },

    findLAKSheet(workbook) {
        // Look for sheet with "LAK" in the name
        return workbook.SheetNames.find(name =>
            name.toLowerCase().includes('lak') ||
            name.toLowerCase().includes('laporan aktivitas')
        ) || workbook.SheetNames[0];
    },

    parseLAKSheet(sheet) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        const result = {
            profile: {},
            activities: {}
        };

        // Parse profile from header rows (rows 3-6 typically)
        result.profile = this.parseProfileFromSheet(sheet);

        // Find the header row (contains "NO", "HARI", "TANGGAL", etc.)
        let headerRow = -1;
        for (let r = 0; r <= Math.min(15, range.e.r); r++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: r, c: 0 })];
            if (cell && String(cell.v).toUpperCase() === 'NO') {
                headerRow = r;
                break;
            }
        }

        if (headerRow === -1) {
            console.warn('Header row not found, using default position');
            headerRow = 10;
        }

        // Parse activities starting from after header
        let currentDay = null;
        let dayNumber = 0;

        for (let r = headerRow + 1; r <= range.e.r; r++) {
            const row = this.getRowData(sheet, r, range.e.c);

            // Skip empty rows or total rows
            if (!row[0] && !row[3]) continue;
            if (String(row[2]).includes('Total Aktivitas')) continue;

            // Check if this is a new day (has day number in first column)
            if (row[0] && !isNaN(Number(row[0]))) {
                dayNumber = Number(row[0]);
                const dateValue = row[2];
                let dateStr;

                if (dateValue instanceof Date) {
                    dateStr = this.formatDate(dateValue);
                } else if (typeof dateValue === 'number') {
                    // Excel serial date
                    const date = this.excelDateToJS(dateValue);
                    dateStr = this.formatDate(date);
                } else {
                    continue; // Skip if date format is not recognized
                }

                currentDay = {
                    tanggal: dateStr,
                    hari: row[1] || '',
                    activities: [],
                    totalMenit: 0,
                    pasienUmum: 0,
                    pasienRujukan: 0,
                    pasienKhusus: 0,
                    keterangan: row[8] || 'TJ'
                };

                result.activities[dateStr] = currentDay;
            }

            // Parse activity if there's time data
            if (currentDay && row[3] && row[4]) {
                const activity = {
                    jamMulai: this.parseTime(row[3]),
                    jamSelesai: this.parseTime(row[4]),
                    kegiatan: String(row[5] || ''),
                    volume: String(row[6] || '1 kegiatan'),
                    menit: Number(row[7]) || 0,
                    kode: String(row[10] || '')
                };

                currentDay.activities.push(activity);
                currentDay.totalMenit += activity.menit;

                // Parse patient counts if available
                if (row[11]) currentDay.pasienUmum = Number(row[11]) || 0;
                if (row[12]) currentDay.pasienRujukan = Number(row[12]) || 0;
                if (row[13]) currentDay.pasienKhusus = Number(row[13]) || 0;
            }
        }

        return result;
    },

    parseProfileFromSheet(sheet) {
        const profile = {
            nama: '',
            nip: '',
            pangkat: '',
            unit: ''
        };

        // Typically profile is in rows 3-6
        for (let r = 2; r <= 8; r++) {
            const labelCell = sheet[XLSX.utils.encode_cell({ r: r, c: 1 })];
            const valueCell = sheet[XLSX.utils.encode_cell({ r: r, c: 2 })];

            if (!labelCell) continue;

            const label = String(labelCell.v).toLowerCase().trim();
            const value = valueCell ? String(valueCell.v).replace(/^:\s*/, '').trim() : '';

            if (label.includes('nama')) profile.nama = value;
            else if (label.includes('nip')) profile.nip = value;
            else if (label.includes('pangkat')) profile.pangkat = value;
            else if (label.includes('unit')) profile.unit = value;
        }

        return profile;
    },

    getRowData(sheet, rowIndex, maxCol) {
        const row = [];
        for (let c = 0; c <= maxCol; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: c })];
            row.push(cell ? cell.v : null);
        }
        return row;
    },

    parseTime(value) {
        if (!value) return '';

        if (typeof value === 'number') {
            // Excel time fraction (e.g., 0.3125 for 07:30)
            const totalMinutes = Math.round(value * 24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        if (value instanceof Date) {
            return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
        }

        // String format
        const match = String(value).match(/(\d{1,2}):(\d{2})/);
        if (match) {
            return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
        }

        return '';
    },

    excelDateToJS(serial) {
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        return new Date(utcValue * 1000);
    },

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // ========================================
    // Export Functions - Match Print Format
    // ========================================

    exportToExcel(year, month) {
        const profile = Storage.getProfile();
        const activities = Storage.getActivitiesForMonth(year, month);

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Build worksheet with print-matching format
        const { wsData, merges } = this.buildPrintFormatData(profile, activities, year, month);

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Apply merged cells
        ws['!merges'] = merges;

        // Set column widths to match print format
        ws['!cols'] = [
            { wch: 5 },   // NO
            { wch: 25 },  // HARI/TANGGAL
            { wch: 15 },  // JAM
            { wch: 50 },  // URAIAN KEGIATAN
            { wch: 15 },  // VOLUME
            { wch: 10 },  // JML MENIT
            { wch: 6 },   // KET
            { wch: 10 }   // PARAF
        ];

        // Set row heights
        ws['!rows'] = [];
        for (let i = 0; i < wsData.length; i++) {
            ws['!rows'][i] = { hpt: 18 };
        }

        // Get month name for sheet title
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const sheetName = `LAK ${monthNames[month - 1].substring(0, 3)}-${String(year).substring(2)}`;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // Generate file name
        const fileName = `LAK_${monthNames[month - 1]}_${year}.xlsx`;

        // Save file
        XLSX.writeFile(wb, fileName);

        return fileName;
    },

    buildPrintFormatData(profile, activities, year, month) {
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const data = [];
        const merges = [];
        let currentRow = 0;

        // ========================================
        // STYLE DEFINITIONS
        // ========================================
        const styles = {
            headerMain: {
                fill: { fgColor: { rgb: "00B0F0" } },
                font: { bold: true, sz: 14, name: 'Calibri' },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            headerSub: {
                fill: { fgColor: { rgb: "00B0F0" } },
                font: { bold: true, sz: 12, name: 'Calibri' },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            profileHeader: {
                fill: { fgColor: { rgb: "00B0F0" } },
                font: { bold: true, name: 'Calibri' },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            profileLabel: {
                fill: { fgColor: { rgb: "F0F0F0" } },
                font: { name: 'Calibri' },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            profileField: {
                font: { name: 'Calibri' },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            tableHeader: {
                fill: { fgColor: { rgb: "00B0F0" } },
                font: { bold: true, name: 'Calibri' },
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            cellCenter: {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            cellLeft: {
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            cellRight: {
                alignment: { horizontal: "right", vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            totalDaily: {
                fill: { fgColor: { rgb: "B4E5F7" } },
                font: { bold: true, name: 'Calibri' },
                alignment: { vertical: "center" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            summaryLabel: {
                font: { bold: true, name: 'Calibri' },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            },
            summaryValue: {
                font: { bold: true, name: 'Calibri' },
                alignment: { horizontal: "right" },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            }
        };

        // Helper to create styled cell
        const sCell = (val, style) => ({ v: val, s: style });

        // ========================================
        // HEADER SECTION
        // ========================================

        // Row 0: REKAPITULASI
        data.push([sCell('REKAPITULASI', styles.headerMain), '', '', '', '', '', '', '']);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        // Row 1: LAPORAN AKTIVITAS KERJA
        data.push([sCell('LAPORAN AKTIVITAS KERJA', styles.headerSub), '', '', '', '', '', '', '']);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        // Row 2: Empty row
        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        // ========================================
        // PROFILE SECTION (DATA PEGAWAI)
        // ========================================

        // Row 3: DATA PEGAWAI header
        data.push([sCell('DATA PEGAWAI', styles.profileHeader), '', '', '', '', '', '', '']);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        // Profile rows
        const profileInfo = [
            { no: '1', label: 'Nama', value: profile.nama || 'Tresna Sary Winingsih, A.Md.Kep' },
            { no: '2', label: 'NIP', value: profile.nip || '199702052025212002' },
            { no: '3', label: 'Pangkat/ Gol', value: profile.pangkat ? profile.pangkat.split('/')[0].trim() : 'VII' },
            { no: '4', label: 'Jabatan', value: profile.pangkat ? (profile.pangkat.split('/')[1]?.trim() || 'Perawat Terampil') : 'Perawat Terampil' },
            { no: '5', label: 'Unit Kerja', value: profile.unit || 'UPTD Puskesmas Tanjungwangi' }
        ];

        profileInfo.forEach(item => {
            data.push([
                sCell(item.no, styles.profileLabel),
                sCell(item.label, styles.profileField),
                sCell(item.value, styles.profileField),
                sCell('', styles.profileField),
                sCell('', styles.profileField),
                sCell('', styles.profileField),
                sCell('', styles.profileField),
                sCell('', styles.profileField)
            ]);
            merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 7 } });
            currentRow++;
        });

        // Row 9: Empty row
        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        // ========================================
        // PERIOD INFO
        // ========================================

        const sortedDates = Object.keys(activities).sort();
        const totalDays = sortedDates.length;

        // Row 10: Period info
        data.push([
            sCell(`KEGIATAN BULAN : ${monthNames[month - 1]} ${year}`, { font: { bold: true } }),
            '', '', '', '',
            sCell(`Jml Hari Kerja : ${totalDays}`, { font: { bold: true }, alignment: { horizontal: "right" } }),
            '', ''
        ]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 4 } });
        merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        // Row 11: Empty row
        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        // ========================================
        // TABLE HEADER
        // ========================================

        data.push([
            sCell('NO.', styles.tableHeader),
            sCell('HARI/ TANGGAL', styles.tableHeader),
            sCell('JAM', styles.tableHeader),
            sCell('URAIAN KEGIATAN', styles.tableHeader),
            sCell('VOLUME KEGIATAN', styles.tableHeader),
            sCell('JML MENIT', styles.tableHeader),
            sCell('KET', styles.tableHeader),
            sCell('PARAF ATASAN', styles.tableHeader)
        ]);
        currentRow++;

        // ========================================
        // TABLE DATA
        // ========================================

        let totalMenit = 0;
        let dayNumber = 1;
        let sickLeaveDays = 0;
        let holidayDays = 0;

        sortedDates.forEach((dateStr) => {
            const day = activities[dateStr];
            const date = new Date(dateStr);
            const dayOfMonth = date.getDate();
            const formattedDate = `${day.hari}, ${String(dayOfMonth).padStart(2, '0')} ${monthNames[month - 1]} ${year}`;

            totalMenit += day.totalMenit || 0;

            if (day.isSickLeave) sickLeaveDays++;
            if (day.isNationalHoliday) holidayDays++;

            const activityCount = day.activities.length;
            const rowspanStart = currentRow;

            day.activities.forEach((act, actIdx) => {
                const row = [];

                if (actIdx === 0) {
                    row.push(sCell(dayNumber, styles.cellCenter));
                    row.push(sCell(formattedDate, styles.cellLeft));
                } else {
                    row.push(sCell('', styles.cellCenter));
                    row.push(sCell('', styles.cellLeft));
                }

                row.push(sCell(`${act.jamMulai} - ${act.jamSelesai}`, styles.cellCenter));
                row.push(sCell(act.kegiatan, styles.cellLeft));
                row.push(sCell('1 kegiatan', styles.cellCenter));
                row.push(sCell(act.menit, styles.cellCenter));
                row.push(sCell(day.keterangan || 'TJ', styles.cellCenter));
                row.push(sCell('', styles.cellCenter));

                data.push(row);
                currentRow++;
            });

            // Daily total row
            data.push([
                sCell('', styles.totalDaily),
                sCell('', styles.totalDaily),
                sCell('Total Aktivitas Harian (menit)', { ...styles.totalDaily, alignment: { horizontal: "right" } }),
                sCell('', styles.totalDaily),
                sCell('', styles.totalDaily),
                sCell(day.totalMenit, { ...styles.totalDaily, alignment: { horizontal: "center" } }),
                sCell('', styles.totalDaily),
                sCell('', styles.totalDaily)
            ]);
            merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 4 } });
            currentRow++;

            const totalRowspan = activityCount + 1;
            if (totalRowspan > 1) {
                merges.push({ s: { r: rowspanStart, c: 0 }, e: { r: rowspanStart + totalRowspan - 1, c: 0 } });
                merges.push({ s: { r: rowspanStart, c: 1 }, e: { r: rowspanStart + totalRowspan - 1, c: 1 } });
            }

            dayNumber++;
        });

        // ========================================
        // SUMMARY TABLE
        // ========================================

        const leaveDays = sickLeaveDays + holidayDays;
        const effectiveDays = totalDays - leaveDays;
        const percentage = totalDays > 0 ? ((effectiveDays / totalDays) * 100).toFixed(1) : 100;

        // Empty row before summary
        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        // Summary rows
        data.push(['', '', '', '', sCell('Total Aktivitas Tugas Jabatan perbulan (menit)', styles.summaryLabel), sCell(totalMenit, styles.summaryValue), sCell('100,0%', styles.cellCenter), '']);
        currentRow++;

        data.push(['', '', '', '', sCell('Total Aktivitas Tugas Tambahan perbulan (menit)', styles.profileField), sCell(0, styles.cellRight), sCell('', styles.cellCenter), '']);
        currentRow++;

        data.push(['', '', '', '', sCell('Total Aktivitas Perbulan (menit)', styles.summaryLabel), sCell(totalMenit, styles.summaryValue), sCell('', styles.cellCenter), '']);
        currentRow++;

        if (leaveDays > 0) {
            data.push(['', '', '', '', sCell(`Hari Tidak Efektif (IS: ${sickLeaveDays}, LN: ${holidayDays})`, styles.profileField), sCell(`${leaveDays} hari`, styles.cellRight), sCell('', styles.cellCenter), '']);
            currentRow++;
        }

        data.push(['', '', '', '', sCell('Capaian Prestasi Kerja', styles.summaryLabel), sCell('', styles.summaryValue), sCell(`${percentage}%`, { ...styles.cellCenter, font: { bold: true, sz: 14 } }), '']);
        currentRow++;

        // ========================================
        // SIGNATURE SECTION
        // ========================================

        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        data.push([sCell('Mengetahui', { alignment: { horizontal: "center" } }), '', '', '', '', '', '', '']);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
        currentRow++;

        data.push([
            sCell('Kepala UPTD Puskesmas Tanjungwangi', { font: { bold: true }, alignment: { horizontal: "center" } }),
            '', '', '', '',
            sCell('ASN Yang dinilai', { font: { bold: true }, alignment: { horizontal: "center" } }),
            '', ''
        ]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
        merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        for (let i = 0; i < 3; i++) {
            data.push(['', '', '', '', '', '', '', '']);
            currentRow++;
        }

        data.push([
            sCell('Ita Fitrotuzzaqiyah, S.KM, M.K.M', { font: { bold: true, underline: true }, alignment: { horizontal: "center" } }),
            '', '', '', '',
            sCell(profile.nama || 'Tresna Sary Winingsih, A.Md.Kep', { font: { bold: true, underline: true }, alignment: { horizontal: "center" } }),
            '', ''
        ]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
        merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        data.push([
            sCell('NIP. 19730416 199503 2 003', { alignment: { horizontal: "center" } }),
            '', '', '', '',
            sCell(`NIP. ${profile.nip || '199702052025212002'}`, { alignment: { horizontal: "center" } }),
            '', ''
        ]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 2 } });
        merges.push({ s: { r: currentRow, c: 5 }, e: { r: currentRow, c: 7 } });
        currentRow++;

        // ========================================
        // PETUNJUK SECTION
        // ========================================

        data.push(['', '', '', '', '', '', '', '']);
        currentRow++;

        data.push([sCell('Petunjuk :', { font: { bold: true } }), '', '', '', '', '', '', '']);
        currentRow++;

        const petunjuk = [
            '1. Kolom 1 : diisi dengan nomor urut hari efektif kerja',
            '2. Kolom 2 : diisi dengan hari dan tanggal kegiatan',
            '3. Kolom 3 : diisi dengan jam kegiatan (dari jam s/d jam {jj.mm - jj.mm})',
            '4. Kolom 4 : diisi dengan uraian kegiatan',
            '5. Kolom 5 : diisi dengan jumlah Volume kegiatan',
            '6. Kolom 6 : diisi dengan jumlah menit aktivitas',
            '7. Kolom 7 : diisi dengan TJ (tugas jabatan atau sesuai SKP), TT (tugas tambahan atau tidak sesuai dengan tugas jabatan/SKP)',
            '8. Kolom 8 : diisi dengan paraf (validasi) atasan'
        ];

        petunjuk.forEach(p => {
            data.push([sCell(p, { font: { sz: 10 } }), '', '', '', '', '', '', '']);
            merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 7 } });
            currentRow++;
        });

        return { wsData: data, merges };
    },


    // Keep old function for backward compatibility
    buildExportData(profile, activities, year, month) {
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const data = [];

        // Header rows
        data.push(['REKAPITULASI']);
        data.push(['LAPORAN AKTIVITAS KERJA']);
        data.push([]);
        data.push(['', 'Nama', `: ${profile.nama}`]);
        data.push(['', 'NIP', `: ${profile.nip}`]);
        data.push(['', 'Pangkat', `: ${profile.pangkat}`]);
        data.push(['', 'Unit', `: ${profile.unit}`]);
        data.push([]);
        data.push(['', `BULAN : ${monthNames[month - 1]} ${year}`]);
        data.push([]);

        // Table header
        data.push([
            'NO', 'HARI', 'TANGGAL', 'JAM MULAI', 'JAM SELESAI',
            'URAIAN KEGIATAN', 'VOLUME', 'JML MENIT', 'KET', 'PARAF',
            'KODE (AUTO)', 'PASIEN UMUM', 'RUJUKAN', 'KHUSUS'
        ]);

        // Sort activities by date
        const sortedDates = Object.keys(activities).sort();

        let dayNumber = 0;
        sortedDates.forEach(dateStr => {
            const day = activities[dateStr];
            dayNumber++;

            day.activities.forEach((act, idx) => {
                const row = [];

                if (idx === 0) {
                    row.push(dayNumber);
                    row.push(day.hari);
                    row.push(new Date(dateStr));
                } else {
                    row.push('');
                    row.push('');
                    row.push('');
                }

                row.push(act.jamMulai);
                row.push(act.jamSelesai);
                row.push(act.kegiatan);
                row.push(act.volume || '1 kegiatan');
                row.push(act.menit);
                row.push(day.keterangan || 'TJ');
                row.push(''); // PARAF
                row.push(act.kode || '');

                if (idx === 0) {
                    row.push(day.pasienUmum || '');
                    row.push(day.pasienRujukan || '');
                    row.push(day.pasienKhusus || '');
                } else {
                    row.push('');
                    row.push('');
                    row.push('');
                }

                data.push(row);
            });

            // Total row for the day
            data.push([
                '', '', 'Total Aktivitas Harian (Menit)', '', '', '', '', day.totalMenit
            ]);
        });

        return data;
    },

    // ========================================
    // UI Handlers
    // ========================================

    setupImportHandlers() {
        const dropZone = document.getElementById('import-drop-zone');
        const fileInput = document.getElementById('import-file');

        if (!dropZone || !fileInput) return;

        // Click to select file
        dropZone.addEventListener('click', () => fileInput.click());

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            const file = e.dataTransfer.files[0];
            if (file) {
                await this.handleFileImport(file);
            }
        });

        // File input change
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.handleFileImport(file);
            }
            fileInput.value = ''; // Reset for same file selection
        });
    },

    async handleFileImport(file) {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            App.showToast('File harus berformat Excel (.xlsx atau .xls)', 'error');
            return;
        }

        try {
            App.showToast('Mengimport data...', 'info');

            const result = await this.importFromFile(file);

            // Show import preview modal
            this.showImportPreview(result, file.name);

        } catch (error) {
            console.error('Import error:', error);
            App.showToast('Gagal mengimport file: ' + error.message, 'error');
        }
    },

    showImportPreview(result, fileName) {
        const activityCount = Object.keys(result.activities).length;
        const totalActivities = Object.values(result.activities)
            .reduce((sum, day) => sum + day.activities.length, 0);

        const modalBody = `
            <div class="import-preview">
                <p><strong>File:</strong> ${fileName}</p>
                <p><strong>Data ditemukan:</strong></p>
                <ul style="margin: 12px 0; padding-left: 20px; color: var(--text-secondary);">
                    <li>${activityCount} hari kerja</li>
                    <li>${totalActivities} aktivitas</li>
                </ul>
                
                ${result.profile.nama ? `
                <div class="card" style="margin: 16px 0; padding: 16px;">
                    <h4 style="margin-bottom: 12px;">Profil dari file:</h4>
                    <p>Nama: ${result.profile.nama}</p>
                    <p>NIP: ${result.profile.nip}</p>
                    <label style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                        <input type="checkbox" id="import-profile" checked>
                        Import profil juga
                    </label>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button class="action-btn secondary" onclick="App.closeModal()" style="flex: 1;">
                        Batal
                    </button>
                    <button class="action-btn primary" id="confirm-import" style="flex: 1;">
                        <span>📥</span> Import Data
                    </button>
                </div>
            </div>
        `;

        App.showModal('Preview Import', modalBody);

        document.getElementById('confirm-import').addEventListener('click', () => {
            this.confirmImport(result);
        });
    },

    confirmImport(result) {
        // Import profile if checkbox is checked
        const importProfile = document.getElementById('import-profile');
        if (importProfile && importProfile.checked && result.profile.nama) {
            Storage.saveProfile(result.profile);
            App.updateProfileDisplay();
        }

        // Merge activities with existing data
        const existingActivities = Storage.getActivities();
        const mergedActivities = { ...existingActivities, ...result.activities };
        Storage.saveActivities(mergedActivities);

        App.closeModal();
        App.showToast(`Berhasil mengimport ${Object.keys(result.activities).length} hari data`, 'success');

        // Refresh dashboard
        App.updateDashboard();
    }
};

// Export for use in other modules
window.ExcelHandler = ExcelHandler;

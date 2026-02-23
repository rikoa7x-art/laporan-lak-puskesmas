/**
 * LAK Puskesmas - Daily Input Module (Simplified)
 * Handles quick patient-only input with auto-template application
 * Includes meeting day option for full-day meetings
 */

const DailyInput = {
    currentDate: null,
    currentTemplate: null,
    isMeetingDay: false,
    isSickLeave: false,
    isNationalHoliday: false,

    // ========================================
    // Initialization
    // ========================================

    init() {
        this.currentDate = new Date().toISOString().split('T')[0];
        this.setupEventListeners();
        this.updateDateDisplay();
        this.loadDataForDate();
    },

    setupEventListeners() {
        // Date navigation
        document.getElementById('prev-date')?.addEventListener('click', () => this.changeDate(-1));
        document.getElementById('next-date')?.addEventListener('click', () => this.changeDate(1));
        document.getElementById('selected-date')?.addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.updateDateDisplay();
            this.loadDataForDate();
        });

        // Patient input handlers - update total on change
        ['patient-umum', 'patient-rujukan', 'patient-khusus'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.updatePatientTotal());
                input.addEventListener('focus', () => input.select());
            }
        });

        // Meeting day toggle
        document.getElementById('is-meeting-day')?.addEventListener('change', (e) => {
            this.isMeetingDay = e.target.checked;
            if (e.target.checked) {
                // Uncheck other options
                this.uncheckOtherOptions('meeting');
            }
            this.toggleSpecialMode();
        });

        // Sick leave toggle
        document.getElementById('is-sick-leave')?.addEventListener('change', (e) => {
            this.isSickLeave = e.target.checked;
            if (e.target.checked) {
                // Uncheck other options
                this.uncheckOtherOptions('sick');
            }
            this.toggleSpecialMode();
        });

        // National holiday toggle
        document.getElementById('is-national-holiday')?.addEventListener('change', (e) => {
            this.isNationalHoliday = e.target.checked;
            if (e.target.checked) {
                // Uncheck other options
                this.uncheckOtherOptions('holiday');
            }
            this.toggleSpecialMode();
        });

        // Save button
        document.getElementById('save-daily')?.addEventListener('click', () => this.saveData());
    },

    // Uncheck other options when one is selected
    uncheckOtherOptions(selected) {
        if (selected !== 'meeting') {
            this.isMeetingDay = false;
            const meetingCheckbox = document.getElementById('is-meeting-day');
            if (meetingCheckbox) meetingCheckbox.checked = false;
        }
        if (selected !== 'sick') {
            this.isSickLeave = false;
            const sickCheckbox = document.getElementById('is-sick-leave');
            if (sickCheckbox) sickCheckbox.checked = false;
        }
        if (selected !== 'holiday') {
            this.isNationalHoliday = false;
            const holidayCheckbox = document.getElementById('is-national-holiday');
            if (holidayCheckbox) holidayCheckbox.checked = false;
        }
    },

    // ========================================
    // Special Day Modes (Meeting, Sick Leave, Holiday)
    // ========================================

    toggleSpecialMode() {
        const meetingDetails = document.getElementById('meeting-details');
        const sickLeaveDetails = document.getElementById('sick-leave-details');
        const holidayDetails = document.getElementById('holiday-details');
        const templateInfo = document.querySelector('.template-info');
        const patientCard = document.querySelector('.patient-count');

        // Hide all details first
        if (meetingDetails) meetingDetails.style.display = 'none';
        if (sickLeaveDetails) sickLeaveDetails.style.display = 'none';
        if (holidayDetails) holidayDetails.style.display = 'none';

        if (this.isMeetingDay) {
            // Show meeting details, hide patient input
            if (meetingDetails) meetingDetails.style.display = 'block';
            if (templateInfo) templateInfo.style.opacity = '0.5';
            if (patientCard) patientCard.style.display = 'none';
            this.updateTemplateDisplay('Rapat / Kegiatan Khusus', '📢');
        } else if (this.isSickLeave) {
            // Show sick leave details, hide patient input
            if (sickLeaveDetails) sickLeaveDetails.style.display = 'block';
            if (templateInfo) templateInfo.style.opacity = '0.5';
            if (patientCard) patientCard.style.display = 'none';
            this.updateTemplateDisplay('Izin Sakit (0 Menit)', '🏥');
        } else if (this.isNationalHoliday) {
            // Show holiday details, hide patient input
            if (holidayDetails) holidayDetails.style.display = 'block';
            if (templateInfo) templateInfo.style.opacity = '0.5';
            if (patientCard) patientCard.style.display = 'none';
            this.updateTemplateDisplay('Libur Nasional (0 Menit)', '🇮🇩');
        } else {
            // Normal day - show template info and patient input
            if (templateInfo) templateInfo.style.opacity = '1';
            if (patientCard) patientCard.style.display = 'block';

            // Restore auto template
            this.applyAutoTemplate();
        }

        this.updateSaveStatus('⏳', 'Siap disimpan');
    },

    // ========================================
    // Date Management
    // ========================================

    changeDate(delta) {
        const date = new Date(this.currentDate);
        date.setDate(date.getDate() + delta);
        this.currentDate = date.toISOString().split('T')[0];
        this.updateDateDisplay();
        this.loadDataForDate();
    },

    updateDateDisplay() {
        const dateInput = document.getElementById('selected-date');
        const dayName = document.getElementById('day-name');

        if (dateInput) dateInput.value = this.currentDate;
        if (dayName) dayName.textContent = this.getDayName(this.currentDate);

        // Check if Sunday
        const dayOfWeek = new Date(this.currentDate).getDay();
        const isSunday = dayOfWeek === 0;

        // Reset all special modes when changing date (only for non-Sunday)
        if (!isSunday) {
            this.isMeetingDay = false;
            this.isSickLeave = false;
            this.isNationalHoliday = false;

            const meetingCheckbox = document.getElementById('is-meeting-day');
            const sickCheckbox = document.getElementById('is-sick-leave');
            const holidayCheckbox = document.getElementById('is-national-holiday');

            if (meetingCheckbox) meetingCheckbox.checked = false;
            if (sickCheckbox) sickCheckbox.checked = false;
            if (holidayCheckbox) holidayCheckbox.checked = false;

            this.toggleSpecialMode();
        }

        // Auto-apply template based on day
        this.applyAutoTemplate();

        // Handle Sunday mode LAST to override everything
        this.handleSundayMode(isSunday);
    },

    handleSundayMode(isSunday) {
        const templateInfo = document.querySelector('.template-info');
        const meetingOptions = document.querySelectorAll('.meeting-option');
        const patientCard = document.getElementById('patient-input-card');
        const quickSave = document.querySelector('.quick-save');

        if (isSunday) {
            // Sunday - hide all input cards
            if (templateInfo) templateInfo.style.display = 'none';
            meetingOptions.forEach(opt => opt.style.display = 'none');
            if (patientCard) patientCard.style.display = 'none';
            if (quickSave) quickSave.innerHTML = `
                <div class="sunday-message">
                    <span class="sunday-icon">🏖️</span>
                    <h3>Hari Minggu - Libur</h3>
                    <p>Tidak ada kegiatan pada hari Minggu</p>
                </div>
            `;
        } else {
            // Normal day - show all cards
            if (templateInfo) templateInfo.style.display = 'block';
            meetingOptions.forEach(opt => opt.style.display = 'block');
            if (patientCard) patientCard.style.display = 'block';
            if (quickSave) quickSave.innerHTML = `
                <div class="save-info">
                    <span class="save-icon">✅</span>
                    <span id="save-status">Siap disimpan</span>
                </div>
                <button class="save-btn-large" id="save-daily">
                    <span>💾</span> Simpan Hari Ini
                </button>
            `;
            // Re-attach save button listener
            document.getElementById('save-daily')?.addEventListener('click', () => this.saveData());
        }
    },

    getDayName(dateStr) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    },

    // ========================================
    // Auto Template Application
    // ========================================

    applyAutoTemplate() {
        const dayOfWeek = new Date(this.currentDate).getDay();
        let templateId, templateName, templateIcon;

        // Determine template based on day
        if (dayOfWeek === 0) {
            // Minggu - libur
            templateId = null;
            templateName = 'Hari Libur';
            templateIcon = '🏖️';
        } else if (dayOfWeek === 6) {
            // Sabtu
            templateId = 'saturday';
            templateName = 'Sabtu (Jam Pendek)';
            templateIcon = '📆';
        } else if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4) {
            // Senin, Selasa, Kamis - Apel
            templateId = 'weekday-apel';
            templateName = 'Hari Kerja (Apel)';
            templateIcon = '🏁';
        } else {
            // Rabu, Jumat - Persiapan
            templateId = 'weekday-prep';
            templateName = 'Hari Kerja (Persiapan)';
            templateIcon = '🔧';
        }

        this.currentTemplate = templateId ? Templates.getById(templateId) : null;

        // Update template display
        this.updateTemplateDisplay(templateName, templateIcon);
    },

    updateTemplateDisplay(templateName, templateIcon) {
        const badge = document.getElementById('template-badge');
        const nameDisplay = document.getElementById('template-name-display');
        const preview = document.getElementById('template-preview');

        if (badge) badge.textContent = templateIcon;
        if (nameDisplay) nameDisplay.textContent = templateName;

        if (preview) {
            if (this.isMeetingDay) {
                preview.innerHTML = `
                    <div class="template-preview-item">
                        <span class="time">07:30 - 15:00</span>
                        <span>Kegiatan Rapat (450 menit)</span>
                    </div>
                `;
            } else if (this.isSickLeave) {
                preview.innerHTML = `
                    <div class="template-preview-item">
                        <span class="time" style="color: #e74c3c;">Izin Sakit</span>
                        <span style="color: #e74c3c;">Total: 0 menit</span>
                    </div>
                `;
            } else if (this.isNationalHoliday) {
                preview.innerHTML = `
                    <div class="template-preview-item">
                        <span class="time" style="color: #27ae60;">Libur Nasional</span>
                        <span style="color: #27ae60;">Total: 0 menit</span>
                    </div>
                `;
            } else if (this.currentTemplate && this.currentTemplate.activities) {
                preview.innerHTML = this.currentTemplate.activities.map(act => `
                    <div class="template-preview-item">
                        <span class="time">${act.jamMulai} - ${act.jamSelesai}</span>
                        <span>${act.kegiatan}</span>
                    </div>
                `).join('');
            } else {
                preview.innerHTML = `
                    <div class="template-preview-item">
                        <span style="color: var(--text-muted);">Tidak ada kegiatan terjadwal</span>
                    </div>
                `;
            }
        }
    },

    // ========================================
    // Data Management
    // ========================================

    loadDataForDate() {
        const dayData = Storage.getDailyActivity(this.currentDate);

        // Reset inputs
        const umumInput = document.getElementById('patient-umum');
        const rujukanInput = document.getElementById('patient-rujukan');
        const khususInput = document.getElementById('patient-khusus');
        const meetingNameInput = document.getElementById('meeting-name');
        const sickLeaveNoteInput = document.getElementById('sick-leave-note');
        const holidayNameInput = document.getElementById('holiday-name');
        const meetingCheckbox = document.getElementById('is-meeting-day');
        const sickCheckbox = document.getElementById('is-sick-leave');
        const holidayCheckbox = document.getElementById('is-national-holiday');

        // Reset all checkboxes first
        if (meetingCheckbox) meetingCheckbox.checked = false;
        if (sickCheckbox) sickCheckbox.checked = false;
        if (holidayCheckbox) holidayCheckbox.checked = false;
        this.isMeetingDay = false;
        this.isSickLeave = false;
        this.isNationalHoliday = false;

        if (dayData) {
            // Data exists - load it
            if (umumInput) umumInput.value = dayData.pasienUmum || 0;
            if (rujukanInput) rujukanInput.value = dayData.pasienRujukan || 0;
            if (khususInput) khususInput.value = dayData.pasienKhusus || 0;

            // Check if it was a special day
            if (dayData.isMeetingDay) {
                this.isMeetingDay = true;
                if (meetingCheckbox) meetingCheckbox.checked = true;
                if (meetingNameInput) meetingNameInput.value = dayData.meetingName || '';
            } else if (dayData.isSickLeave) {
                this.isSickLeave = true;
                if (sickCheckbox) sickCheckbox.checked = true;
                if (sickLeaveNoteInput) sickLeaveNoteInput.value = dayData.sickLeaveNote || '';
            } else if (dayData.isNationalHoliday) {
                this.isNationalHoliday = true;
                if (holidayCheckbox) holidayCheckbox.checked = true;
                if (holidayNameInput) holidayNameInput.value = dayData.holidayName || '';
            }

            this.toggleSpecialMode();
            this.updateSaveStatus('✅', 'Data tersimpan');
        } else {
            // No data - reset to 0
            if (umumInput) umumInput.value = 0;
            if (rujukanInput) rujukanInput.value = 0;
            if (khususInput) khususInput.value = 0;
            if (meetingNameInput) meetingNameInput.value = '';
            if (sickLeaveNoteInput) sickLeaveNoteInput.value = '';
            if (holidayNameInput) holidayNameInput.value = '';

            this.toggleSpecialMode();
            this.updateSaveStatus('📝', 'Belum ada data');
        }

        this.updatePatientTotal();
    },

    updatePatientTotal() {
        const umum = parseInt(document.getElementById('patient-umum')?.value) || 0;
        const rujukan = parseInt(document.getElementById('patient-rujukan')?.value) || 0;
        const khusus = parseInt(document.getElementById('patient-khusus')?.value) || 0;

        const total = umum + rujukan + khusus;

        const totalDisplay = document.getElementById('total-patients-display');
        if (totalDisplay) {
            totalDisplay.textContent = total;
        }

        // Update status to indicate unsaved changes
        this.updateSaveStatus('⏳', 'Siap disimpan');
    },

    updateSaveStatus(icon, text) {
        const saveIcon = document.querySelector('.save-icon');
        const saveStatus = document.getElementById('save-status');

        if (saveIcon) saveIcon.textContent = icon;
        if (saveStatus) saveStatus.textContent = text;
    },

    // ========================================
    // Save Operations
    // ========================================

    saveData() {
        const dayOfWeek = new Date(this.currentDate).getDay();

        // Check if it's a holiday (Sunday) and not a special day
        if (dayOfWeek === 0 && !this.isMeetingDay && !this.isSickLeave && !this.isNationalHoliday) {
            App.showToast('Hari Minggu tidak ada kegiatan', 'warning');
            return;
        }

        let activities, totalMenit, keterangan;
        const pasienUmum = parseInt(document.getElementById('patient-umum')?.value) || 0;
        const pasienRujukan = parseInt(document.getElementById('patient-rujukan')?.value) || 0;
        const pasienKhusus = parseInt(document.getElementById('patient-khusus')?.value) || 0;

        if (this.isSickLeave) {
            // Sick leave - 0 minutes
            const sickNote = document.getElementById('sick-leave-note')?.value || 'Izin Sakit';

            activities = [{
                jamMulai: '-',
                jamSelesai: '-',
                kegiatan: `Izin Sakit: ${sickNote}`,
                kode: 'Izin Sakit',
                volume: '-',
                menit: 0
            }];
            totalMenit = 0;
            keterangan = 'IS'; // Izin Sakit
        } else if (this.isNationalHoliday) {
            // National holiday - 0 minutes
            const holidayName = document.getElementById('holiday-name')?.value || 'Libur Nasional';

            activities = [{
                jamMulai: '-',
                jamSelesai: '-',
                kegiatan: `Libur Nasional: ${holidayName}`,
                kode: 'Libur Nasional',
                volume: '-',
                menit: 0
            }];
            totalMenit = 0;
            keterangan = 'LN'; // Libur Nasional
        } else if (this.isMeetingDay) {
            // Meeting day - single activity for 450 minutes
            const meetingName = document.getElementById('meeting-name')?.value || 'Rapat';

            activities = [{
                jamMulai: '07:30',
                jamSelesai: '15:00',
                kegiatan: meetingName,
                kode: 'Rapat',
                volume: '1 kegiatan',
                menit: 450
            }];
            totalMenit = 450;
            keterangan = 'TJ';
        } else {
            // Normal day - use template
            if (!this.currentTemplate) {
                App.showToast('Template tidak tersedia', 'warning');
                return;
            }

            activities = this.currentTemplate.activities.map(act => ({
                jamMulai: act.jamMulai,
                jamSelesai: act.jamSelesai,
                kegiatan: this.buildKegiatanText(act, pasienUmum, pasienRujukan, pasienKhusus),
                kode: act.kode,
                volume: '1 kegiatan',
                menit: Templates.calculateMinutes(act.jamMulai, act.jamSelesai)
            }));
            totalMenit = activities.reduce((sum, act) => sum + act.menit, 0);
            keterangan = 'TJ';
        }

        // Build day data
        const dayData = {
            tanggal: this.currentDate,
            hari: this.getDayName(this.currentDate),
            activities: activities,
            totalMenit: totalMenit,
            pasienUmum: this.isSickLeave || this.isNationalHoliday ? 0 : pasienUmum,
            pasienRujukan: this.isSickLeave || this.isNationalHoliday ? 0 : pasienRujukan,
            pasienKhusus: this.isSickLeave || this.isNationalHoliday ? 0 : pasienKhusus,
            keterangan: keterangan,
            isMeetingDay: this.isMeetingDay,
            meetingName: this.isMeetingDay ? document.getElementById('meeting-name')?.value : null,
            isSickLeave: this.isSickLeave,
            sickLeaveNote: this.isSickLeave ? document.getElementById('sick-leave-note')?.value : null,
            isNationalHoliday: this.isNationalHoliday,
            holidayName: this.isNationalHoliday ? document.getElementById('holiday-name')?.value : null
        };

        // Save to storage
        Storage.saveDailyActivity(this.currentDate, dayData);

        // Update UI
        this.updateSaveStatus('✅', 'Tersimpan');
        App.showToast('Data berhasil disimpan', 'success');
        App.updateDashboard();
    },

    buildKegiatanText(activity, umum, rujukan, khusus) {
        const kode = activity.kode || '';

        // For Poli Umum, include patient counts
        if (kode === 'Poli Umum') {
            return `Pelayanan poli umum : ${umum} pasien rujukan : ${rujukan} pasien`;
        }

        // For Poli Khusus, include khusus count
        if (kode === 'Poli Khusus') {
            return `Pemeriksaan poli khusus : ${khusus} pasien`;
        }

        return activity.kegiatan;
    },

    // ========================================
    // Quick Input from Dashboard
    // ========================================

    goToToday() {
        this.currentDate = new Date().toISOString().split('T')[0];
        App.navigateTo('daily-input');

        // Small delay to ensure page is active
        setTimeout(() => {
            this.updateDateDisplay();
            this.loadDataForDate();

            // Focus on first input
            document.getElementById('patient-umum')?.focus();
        }, 100);
    }
};

// Export for use in other modules
window.DailyInput = DailyInput;

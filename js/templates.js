/**
 * LAK Puskesmas - Templates Module
 * Manages activity templates for quick daily input
 */

const Templates = {
    // Activity code options
    ACTIVITY_CODES: [
        'Apel Pagi',
        'Persiapan',
        'Poli Umum',
        'Poli Khusus',
        'Admin/Laporan',
        'Kunjungan Rumah',
        'Posyandu',
        'Penyuluhan',
        'Rapat',
        'Lainnya'
    ],

    // ========================================
    // Template CRUD Operations
    // ========================================

    getAll() {
        return Storage.getTemplates();
    },

    getById(id) {
        const templates = this.getAll();
        return templates.find(t => t.id === id);
    },

    add(template) {
        const templates = this.getAll();
        template.id = template.id || 'template-' + Date.now();
        templates.push(template);
        Storage.saveTemplates(templates);
        return template;
    },

    update(id, updatedTemplate) {
        const templates = this.getAll();
        const index = templates.findIndex(t => t.id === id);
        if (index !== -1) {
            templates[index] = { ...templates[index], ...updatedTemplate };
            Storage.saveTemplates(templates);
            return templates[index];
        }
        return null;
    },

    delete(id) {
        let templates = this.getAll();
        templates = templates.filter(t => t.id !== id);
        Storage.saveTemplates(templates);
    },

    // ========================================
    // Template Application
    // ========================================

    applyToDate(templateId, dateStr) {
        const template = this.getById(templateId);
        if (!template) return null;

        const activities = template.activities.map(act => ({
            ...act,
            menit: this.calculateMinutes(act.jamMulai, act.jamSelesai)
        }));

        const totalMenit = activities.reduce((sum, act) => sum + act.menit, 0);

        return {
            tanggal: dateStr,
            hari: this.getDayName(dateStr),
            activities: activities,
            totalMenit: totalMenit,
            pasienUmum: 0,
            pasienRujukan: 0,
            pasienKhusus: 0,
            keterangan: 'TJ'
        };
    },

    // ========================================
    // Helper Methods
    // ========================================

    calculateMinutes(jamMulai, jamSelesai) {
        const [h1, m1] = jamMulai.split(':').map(Number);
        const [h2, m2] = jamSelesai.split(':').map(Number);
        return (h2 * 60 + m2) - (h1 * 60 + m1);
    },

    getDayName(dateStr) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    },

    getSuggestedTemplate(dateStr) {
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay();

        // Sunday = 0, Monday = 1, ... Saturday = 6
        if (dayOfWeek === 0) return null; // Minggu - libur
        if (dayOfWeek === 6) return 'saturday'; // Sabtu
        if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4) return 'weekday-apel'; // Senin, Selasa, Kamis
        return 'weekday-prep'; // Rabu, Jumat
    },

    // ========================================
    // UI Rendering
    // ========================================

    renderTemplatesList() {
        const container = document.getElementById('templates-list');
        if (!container) return;

        const templates = this.getAll();

        if (templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📑</span>
                    <p>Belum ada template</p>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map(template => `
            <div class="template-item" data-id="${template.id}">
                <div class="template-header">
                    <span class="template-name">${template.name}</span>
                    <div class="template-actions">
                        <button class="btn-edit-template" data-id="${template.id}">✏️ Edit</button>
                        <button class="btn-delete-template" data-id="${template.id}">🗑️ Hapus</button>
                    </div>
                </div>
                <div class="template-activities">
                    ${template.activities.map(act => `
                        <div class="template-activity">
                            <span class="template-time">${act.jamMulai} - ${act.jamSelesai}</span>
                            <span class="template-desc">${act.kegiatan}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.btn-edit-template').forEach(btn => {
            btn.addEventListener('click', () => this.showEditModal(btn.dataset.id));
        });

        container.querySelectorAll('.btn-delete-template').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id));
        });
    },

    showEditModal(templateId) {
        const template = templateId ? this.getById(templateId) : null;
        const isNew = !template;

        const modalTitle = isNew ? 'Tambah Template Baru' : 'Edit Template';
        const modalBody = `
            <form id="template-form" class="settings-form">
                <div class="form-group">
                    <label for="template-name">Nama Template</label>
                    <input type="text" id="template-name" value="${template?.name || ''}" placeholder="Contoh: Hari Kerja Senin" required>
                </div>
                <div class="form-group">
                    <label for="template-desc">Deskripsi</label>
                    <input type="text" id="template-desc" value="${template?.description || ''}" placeholder="Deskripsi singkat template">
                </div>
                <div class="form-group">
                    <label>Daftar Kegiatan</label>
                    <div id="template-activities-form">
                        ${(template?.activities || [{ jamMulai: '07:30', jamSelesai: '08:00', kegiatan: '', kode: 'Lainnya' }]).map((act, idx) => this.renderActivityFormRow(act, idx)).join('')}
                    </div>
                    <button type="button" class="add-activity-btn" id="add-template-activity">
                        <span>➕</span> Tambah Kegiatan
                    </button>
                </div>
                <button type="submit" class="save-btn" style="width: 100%; margin-top: 20px;">
                    <span>💾</span> Simpan Template
                </button>
            </form>
        `;

        App.showModal(modalTitle, modalBody);

        // Add activity row handler
        document.getElementById('add-template-activity').addEventListener('click', () => {
            const container = document.getElementById('template-activities-form');
            const idx = container.children.length;
            const row = document.createElement('div');
            row.innerHTML = this.renderActivityFormRow({ jamMulai: '', jamSelesai: '', kegiatan: '', kode: 'Lainnya' }, idx);
            container.appendChild(row.firstElementChild);
        });

        // Form submit handler
        document.getElementById('template-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = {
                id: template?.id || null,
                name: document.getElementById('template-name').value,
                description: document.getElementById('template-desc').value,
                activities: this.getActivitiesFromForm()
            };

            if (isNew) {
                this.add(formData);
                App.showToast('Template berhasil ditambahkan', 'success');
            } else {
                this.update(templateId, formData);
                App.showToast('Template berhasil diperbarui', 'success');
            }

            App.closeModal();
            this.renderTemplatesList();
        });
    },

    renderActivityFormRow(activity, index) {
        return `
            <div class="activity-entry template-activity-row" data-index="${index}">
                <input type="time" class="template-jam-mulai" value="${activity.jamMulai}" required>
                <input type="time" class="template-jam-selesai" value="${activity.jamSelesai}" required>
                <select class="template-kode">
                    ${this.ACTIVITY_CODES.map(code =>
            `<option value="${code}" ${activity.kode === code ? 'selected' : ''}>${code}</option>`
        ).join('')}
                </select>
                <input type="text" class="template-kegiatan" value="${activity.kegiatan}" placeholder="Uraian kegiatan" required style="grid-column: span 2;">
                <button type="button" class="activity-delete remove-template-activity">✕</button>
            </div>
        `;
    },

    getActivitiesFromForm() {
        const rows = document.querySelectorAll('.template-activity-row');
        return Array.from(rows).map(row => ({
            jamMulai: row.querySelector('.template-jam-mulai').value,
            jamSelesai: row.querySelector('.template-jam-selesai').value,
            kegiatan: row.querySelector('.template-kegiatan').value,
            kode: row.querySelector('.template-kode').value
        })).filter(act => act.jamMulai && act.jamSelesai && act.kegiatan);
    },

    confirmDelete(templateId) {
        const template = this.getById(templateId);
        if (!template) return;

        if (confirm(`Hapus template "${template.name}"?`)) {
            this.delete(templateId);
            App.showToast('Template berhasil dihapus', 'success');
            this.renderTemplatesList();
        }
    }
};

// Export for use in other modules
window.Templates = Templates;

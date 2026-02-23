/**
 * LAK Puskesmas - Storage Module
 * Handles localStorage operations for data persistence
 */

const Storage = {
    KEYS: {
        PROFILE: 'lak_profile',
        TEMPLATES: 'lak_templates',
        ACTIVITIES: 'lak_activities',
        SETTINGS: 'lak_settings'
    },

    // ========================================
    // Generic Storage Methods
    // ========================================

    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            return false;
        }
    },

    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Storage load error:', error);
            return defaultValue;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    // ========================================
    // Profile Methods
    // ========================================

    getProfile() {
        return this.load(this.KEYS.PROFILE, {
            nama: '',
            nip: '',
            pangkat: '',
            unit: ''
        });
    },

    saveProfile(profile) {
        return this.save(this.KEYS.PROFILE, profile);
    },

    // ========================================
    // Templates Methods
    // ========================================

    getTemplates() {
        return this.load(this.KEYS.TEMPLATES, this.getDefaultTemplates());
    },

    saveTemplates(templates) {
        return this.save(this.KEYS.TEMPLATES, templates);
    },

    getDefaultTemplates() {
        return [
            {
                id: 'weekday-apel',
                name: 'Hari Kerja (Apel)',
                description: 'Senin, Selasa, Kamis dengan apel pagi',
                activities: [
                    { jamMulai: '07:30', jamSelesai: '08:00', kegiatan: 'Apel pagi', kode: 'Apel Pagi' },
                    { jamMulai: '08:00', jamSelesai: '12:30', kegiatan: 'Pelayanan poli umum', kode: 'Poli Umum' },
                    { jamMulai: '12:30', jamSelesai: '14:00', kegiatan: 'Pemeriksaan poli khusus', kode: 'Poli Khusus' },
                    { jamMulai: '14:00', jamSelesai: '15:00', kegiatan: 'Pencatatan dan pelaporan hasil Kegiatan', kode: 'Admin/Laporan' }
                ]
            },
            {
                id: 'weekday-prep',
                name: 'Hari Kerja (Persiapan)',
                description: 'Rabu, Jumat dengan persiapan pelayanan',
                activities: [
                    { jamMulai: '07:30', jamSelesai: '08:00', kegiatan: 'Persiapan pelayanan dan sterilisasi alat', kode: 'Persiapan' },
                    { jamMulai: '08:00', jamSelesai: '12:30', kegiatan: 'Pelayanan poli umum', kode: 'Poli Umum' },
                    { jamMulai: '12:30', jamSelesai: '14:00', kegiatan: 'Pemeriksaan poli khusus', kode: 'Poli Khusus' },
                    { jamMulai: '14:00', jamSelesai: '15:00', kegiatan: 'Pencatatan dan pelaporan hasil Kegiatan', kode: 'Admin/Laporan' }
                ]
            },
            {
                id: 'saturday',
                name: 'Sabtu',
                description: 'Jadwal Sabtu (jam pendek)',
                activities: [
                    { jamMulai: '08:00', jamSelesai: '08:15', kegiatan: 'Persiapan pelayanan dan sterilisasi alat', kode: 'Persiapan' },
                    { jamMulai: '08:15', jamSelesai: '10:30', kegiatan: 'Pelayanan poli umum', kode: 'Poli Umum' },
                    { jamMulai: '10:30', jamSelesai: '11:30', kegiatan: 'Pemeriksaan poli khusus', kode: 'Poli Khusus' },
                    { jamMulai: '11:30', jamSelesai: '12:00', kegiatan: 'Pencatatan dan pelaporan hasil Kegiatan', kode: 'Admin/Laporan' }
                ]
            }
        ];
    },

    // ========================================
    // Activities Methods
    // ========================================

    getActivities() {
        return this.load(this.KEYS.ACTIVITIES, {});
    },

    saveActivities(activities) {
        return this.save(this.KEYS.ACTIVITIES, activities);
    },

    getDailyActivity(dateStr) {
        const activities = this.getActivities();
        return activities[dateStr] || null;
    },

    saveDailyActivity(dateStr, dayData) {
        const activities = this.getActivities();
        activities[dateStr] = dayData;
        return this.saveActivities(activities);
    },

    deleteDailyActivity(dateStr) {
        const activities = this.getActivities();
        delete activities[dateStr];
        return this.saveActivities(activities);
    },

    getActivitiesForMonth(year, month) {
        const activities = this.getActivities();
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthActivities = {};

        Object.keys(activities).forEach(dateStr => {
            if (dateStr.startsWith(prefix)) {
                monthActivities[dateStr] = activities[dateStr];
            }
        });

        return monthActivities;
    },

    // ========================================
    // Statistics Methods
    // ========================================

    getMonthStats(year, month) {
        const activities = this.getActivitiesForMonth(year, month);
        const stats = {
            totalDays: 0,
            totalMinutes: 0,
            totalPatients: 0,
            totalActivities: 0,
            patientUmum: 0,
            patientRujukan: 0,
            patientKhusus: 0
        };

        Object.values(activities).forEach(day => {
            stats.totalDays++;
            stats.totalMinutes += day.totalMenit || 0;
            stats.totalActivities += (day.activities || []).length;
            stats.patientUmum += day.pasienUmum || 0;
            stats.patientRujukan += day.pasienRujukan || 0;
            stats.patientKhusus += day.pasienKhusus || 0;
        });

        stats.totalPatients = stats.patientUmum + stats.patientRujukan + stats.patientKhusus;

        return stats;
    },

    // ========================================
    // Backup & Restore
    // ========================================

    exportAllData() {
        return {
            profile: this.getProfile(),
            templates: this.getTemplates(),
            activities: this.getActivities(),
            exportDate: new Date().toISOString()
        };
    },

    importAllData(data) {
        try {
            if (data.profile) this.saveProfile(data.profile);
            if (data.templates) this.saveTemplates(data.templates);
            if (data.activities) this.saveActivities(data.activities);
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },

    clearAllData() {
        Object.values(this.KEYS).forEach(key => this.remove(key));
    },

    // ========================================
    // Cloud Sync (Firebase)
    // ========================================

    async syncToCloud() {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
            throw new Error("Firebase belum dinkonfigurasi. Silakan penuhi kredensial di firebase-config.js.");
        }

        const userId = window.FirebaseManager.getUserId();
        if (!userId) {
            throw new Error("Gagal mengenali pengguna (Belum Login/Anonymous).");
        }

        const dataToSync = this.exportAllData();
        const db = window.FirebaseManager.getDb();

        try {
            await db.collection("users").doc(userId).set({
                appData: dataToSync,
                lastSync: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error("Cloud Sync Up Error:", error);
            throw error;
        }
    },

    async syncFromCloud() {
        if (!window.FirebaseManager || !window.FirebaseManager.isConfigured()) {
            throw new Error("Firebase belum dinkonfigurasi. Silakan penuhi kredensial di firebase-config.js.");
        }

        const userId = window.FirebaseManager.getUserId();
        if (!userId) {
            throw new Error("Gagal mengenali pengguna (Belum Login/Anonymous).");
        }

        const db = window.FirebaseManager.getDb();

        try {
            const doc = await db.collection("users").doc(userId).get();
            if (doc.exists && doc.data().appData) {
                const isImported = this.importAllData(doc.data().appData);
                if (!isImported) throw new Error("Gagal menerapkan data dari Cloud.");
                return doc.data().lastSync;
            } else {
                throw new Error("Tidak ada data tersimpan di Cloud.");
            }
        } catch (error) {
            console.error("Cloud Sync Down Error:", error);
            throw error;
        }
    }
};

// Export for use in other modules
window.Storage = Storage;

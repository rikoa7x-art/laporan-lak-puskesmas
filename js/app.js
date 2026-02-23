/**
 * LAK Puskesmas - Main Application Controller
 * Handles navigation, initialization, and global UI functions
 */

const App = {
    currentPage: 'dashboard',

    // ========================================
    // Initialization
    // ========================================

    init() {
        this.setupNavigation();
        this.setupHeaderDate();
        this.updateProfileDisplay();
        this.updateDashboard();

        // Initialize modules
        DailyInput.init();
        Reports.init();
        Templates.renderTemplatesList();
        ExcelHandler.setupImportHandlers();

        // Setup settings
        this.setupSettings();

        // Setup quick action buttons
        this.setupQuickActions();

        // Setup mobile menu
        this.setupMobileMenu();

        console.log('LAK Puskesmas initialized');
    },

    // ========================================
    // Navigation
    // ========================================

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page visibility
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'daily-input': 'Input Harian',
            'templates': 'Template Kegiatan',
            'reports': 'Laporan',
            'settings': 'Pengaturan'
        };
        document.getElementById('page-title').textContent = titles[page] || 'LAK Puskesmas';

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('active');

        this.currentPage = page;

        // Reinitialize page-specific content
        if (page === 'daily-input') {
            DailyInput.updateDateDisplay();
            DailyInput.loadActivitiesForDate();
        } else if (page === 'templates') {
            Templates.renderTemplatesList();
        } else if (page === 'dashboard') {
            this.updateDashboard();
        }
    },

    // ========================================
    // Header & Profile
    // ========================================

    setupHeaderDate() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('id-ID', options);
        }
    },

    updateProfileDisplay() {
        const profile = Storage.getProfile();

        const sidebarName = document.getElementById('sidebar-user-name');
        const sidebarRole = document.getElementById('sidebar-user-role');

        if (sidebarName) sidebarName.textContent = profile.nama || '-';
        if (sidebarRole) sidebarRole.textContent = profile.pangkat || 'Perawat';

        // Update avatar initials
        const avatar = document.querySelector('.user-avatar');
        if (avatar && profile.nama) {
            const initials = profile.nama.split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
            avatar.textContent = initials || 'TS';
        }

        // Update settings form
        const nameInput = document.getElementById('profile-name');
        const nipInput = document.getElementById('profile-nip');
        const pangkatInput = document.getElementById('profile-pangkat');
        const unitInput = document.getElementById('profile-unit');

        if (nameInput) nameInput.value = profile.nama || '';
        if (nipInput) nipInput.value = profile.nip || '';
        if (pangkatInput) pangkatInput.value = profile.pangkat || '';
        if (unitInput) unitInput.value = profile.unit || '';
    },

    // ========================================
    // Dashboard
    // ========================================

    updateDashboard() {
        const now = new Date();
        const stats = Storage.getMonthStats(now.getFullYear(), now.getMonth() + 1);

        // Update stat cards
        document.getElementById('stat-days').textContent = stats.totalDays;
        document.getElementById('stat-minutes').textContent = stats.totalMinutes.toLocaleString();
        document.getElementById('stat-patients').textContent = stats.totalPatients;
        document.getElementById('stat-activities').textContent = stats.totalActivities;

        // Update recent activities
        Reports.renderRecentActivities();

        // Update monthly chart
        Reports.renderMonthlyChart();
    },

    // ========================================
    // Quick Actions
    // ========================================

    setupQuickActions() {
        document.getElementById('btn-input-today')?.addEventListener('click', () => {
            DailyInput.goToToday();
        });

        document.getElementById('btn-import-excel')?.addEventListener('click', () => {
            this.navigateTo('settings');
            // Focus on import area
            setTimeout(() => {
                document.getElementById('import-drop-zone')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        document.getElementById('btn-export-report')?.addEventListener('click', () => {
            this.navigateTo('reports');
        });
    },

    // ========================================
    // Settings
    // ========================================

    setupSettings() {
        // Save profile
        document.getElementById('save-profile')?.addEventListener('click', () => {
            const profile = {
                nama: document.getElementById('profile-name').value.trim(),
                nip: document.getElementById('profile-nip').value.trim(),
                pangkat: document.getElementById('profile-pangkat').value.trim(),
                unit: document.getElementById('profile-unit').value.trim()
            };

            Storage.saveProfile(profile);
            this.updateProfileDisplay();
            this.showToast('Profil berhasil disimpan', 'success');
        });

        // Backup data
        document.getElementById('backup-data')?.addEventListener('click', () => {
            const data = Storage.exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `LAK_Backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            this.showToast('Backup berhasil didownload', 'success');
        });

        // Restore data
        document.getElementById('restore-data')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (confirm('Ini akan menimpa data yang ada. Lanjutkan?')) {
                            Storage.importAllData(data);
                            this.updateProfileDisplay();
                            this.updateDashboard();
                            this.showToast('Data berhasil direstore', 'success');
                        }
                    } catch (error) {
                        this.showToast('File backup tidak valid', 'error');
                    }
                };
                reader.readAsText(file);
            };

            input.click();
        });

        // Add template button
        document.getElementById('add-template')?.addEventListener('click', () => {
            Templates.showEditModal(null);
        });
    },

    // ========================================
    // Mobile Menu
    // ========================================

    setupMobileMenu() {
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.querySelector('.main-content')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.remove('active');
        });
    },

    // ========================================
    // Modal
    // ========================================

    showModal(title, bodyHtml) {
        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');

        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = bodyHtml;
        if (overlay) overlay.classList.add('active');

        // Close button handler
        document.getElementById('modal-close')?.addEventListener('click', () => {
            this.closeModal();
        });

        // Close on overlay click
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        // Handle delete buttons in modal forms
        document.querySelectorAll('.remove-template-activity').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.template-activity-row')?.remove();
            });
        });
    },

    closeModal() {
        document.getElementById('modal-overlay')?.classList.remove('active');
    },

    // ========================================
    // Toast Notifications
    // ========================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other modules
window.App = App;

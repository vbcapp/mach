/**
 * ModalSystem - Centralized UI for Alerts, Confirms, and Toasts
 * Replaces native browser dialogs with Neo-Brutalism styled components.
 */

const ModalSystem = {
    // Queue to prevent stacking multiple modals (optional, but good practice)
    queue: [],
    isShowing: false,

    /**
     * Show a confirmation modal
     * @param {string} title - Title of the modal
     * @param {string} message - Content message
     * @param {Function} onConfirm - Callback when user clicks Confirm
     * @param {Function} onCancel - Callback when user clicks Cancel
     * @param {object} options - { confirmText, cancelText, isDestructive }
     */
    confirm: function (title, message, onConfirm, onCancel, options = {}) {
        const {
            confirmText = '確認',
            cancelText = '取消',
            isDestructive = false
        } = options;

        this._createModal({
            title,
            message,
            buttons: [
                {
                    text: cancelText,
                    class: 'bg-white text-black hover:bg-gray-100',
                    onClick: () => {
                        if (onCancel) onCancel();
                        this._closeModal();
                    }
                },
                {
                    text: confirmText,
                    class: isDestructive ? 'bg-[#FF4D4D] text-white hover:bg-red-600' : 'bg-[#FFD600] text-black hover:bg-yellow-400',
                    onClick: () => {
                        if (onConfirm) onConfirm();
                        this._closeModal();
                    }
                }
            ]
        });
    },

    /**
     * Show an alert modal
     * @param {string} title
     * @param {string} message
     * @param {Function} onOk
     */
    alert: function (title, message, onOk) {
        this._createModal({
            title,
            message,
            buttons: [
                {
                    text: '我知道了',
                    class: 'bg-black text-white hover:bg-gray-800',
                    onClick: () => {
                        if (onOk) onOk();
                        this._closeModal();
                    }
                }
            ]
        });
    },

    /**
     * Show a toast notification
     * @param {string} message
     * @param {string} type - 'success', 'error', 'info'
     * @param {number} duration - ms
     */
    toast: function (message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container') || this._createToastContainer();

        const toast = document.createElement('div');

        let bgClass = 'bg-white';
        let icon = 'info';

        if (type === 'success') {
            bgClass = 'bg-[#FFD600]';
            icon = 'check_circle';
        } else if (type === 'error') {
            bgClass = 'bg-[#FF4D4D] text-white';
            icon = 'error';
        }

        toast.className = `
            flex items-center gap-3 px-4 py-3 mb-3 
            border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
            transform transition-all duration-300 translate-y-10 opacity-0
            ${bgClass}
        `;

        toast.innerHTML = `
            <span class="material-symbols-outlined text-xl font-bold">${icon}</span>
            <span class="font-bold text-sm leading-tight">${message}</span>
        `;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        // Remove after duration
        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // --- Internal Methods ---

    _createToastContainer: function () {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[320px] px-4 pointer-events-none';
        // Allow pointer events on children (toasts) if needed, but usually toasts are just for display
        document.body.appendChild(container);
        return container;
    },

    _createModal: function ({ title, message, buttons }) {
        // Remove existing modal if any
        if (document.getElementById('custom-modal-overlay')) {
            document.getElementById('custom-modal-overlay').remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'custom-modal-overlay';
        overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 opacity-0 transition-opacity duration-200';

        const modal = document.createElement('div');
        modal.className = 'bg-white border-[3px] border-black w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform scale-95 transition-transform duration-200';

        const buttonsHtml = buttons.map((btn, index) => `
            <button id="modal-btn-${index}" class="flex-1 py-3 border-2 border-black font-black text-sm uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ${btn.class}">
                ${btn.text}
            </button>
        `).join('');

        modal.innerHTML = `
            <div class="bg-black text-white px-4 py-2 flex justify-between items-center">
                <h3 class="font-black text-lg tracking-wider uppercase">${title}</h3>
                <button onclick="ModalSystem._closeModal()" class="material-symbols-outlined hover:text-gray-300">close</button>
            </div>
            <div class="p-6">
                <p class="font-bold text-lg mb-6 leading-relaxed">${message}</p>
                <div class="flex gap-3">
                    ${buttonsHtml}
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Bind events
        buttons.forEach((btn, index) => {
            document.getElementById(`modal-btn-${index}`).onclick = btn.onClick;
        });

        // Animate In
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
            modal.classList.add('scale-100');
        });
    },

    _closeModal: function () {
        const overlay = document.getElementById('custom-modal-overlay');
        const modal = overlay?.querySelector('div'); // The modal itself

        if (overlay && modal) {
            overlay.classList.add('opacity-0');
            modal.classList.remove('scale-100');
            modal.classList.add('scale-95');

            setTimeout(() => {
                overlay.remove();
            }, 200);
        }
    }
};

// Global Exposure
window.ModalSystem = ModalSystem;

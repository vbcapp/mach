/**
 * Onboarding System
 * Handles the 3-step new user tutorial.
 */
const OnboardingSystem = {
    currentStep: 1,
    overlayId: 'onboarding-overlay',

    /**
     * Check if onboarding should be shown and show it.
     */
    checkAndShow() {
        if (localStorage.getItem('show_onboarding') === 'true') {
            this.show();
        }
    },

    /**
     * Show the onboarding overlay.
     */
    show() {
        // Prevent scrolling on body
        document.body.style.overflow = 'hidden';

        // Remove existing if any
        const existing = document.getElementById(this.overlayId);
        if (existing) existing.remove();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = this.overlayId;
        // Use h-[100dvh] to ensure full viewport height on mobile
        overlay.className = 'fixed inset-0 z-[99999] bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center animate-fade-in text-base';
        document.body.appendChild(overlay);

        this.currentStep = 1;
        this.renderStep(1);
    },

    /**
     * Close the onboarding overlay.
     */
    close() {
        const overlay = document.getElementById(this.overlayId);
        if (overlay) {
            overlay.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
                localStorage.removeItem('show_onboarding'); // Mark as done

                // If we are not on index.html, redirect
                if (!window.location.pathname.includes('index.html') && !window.location.pathname.endsWith('/')) {
                    window.location.href = 'index.html';
                }
            }, 300);
        }
    },

    /**
     * Render a specific step.
     */
    renderStep(step) {
        const overlay = document.getElementById(this.overlayId);
        if (!overlay) return;

        // Shared Layout Components
        // We use flex-1 for the middle content to make it stretch/shrink, 
        // and shrink-0 for header/footer to keep them fixed.

        const indicators = (current) => `
            <div class="flex flex-row items-center justify-center gap-3 h-4">
                <div class="h-3 w-${current === 1 ? '8' : '3'} rounded-full ${current === 1 ? 'bg-[#f9d006] border-2 border-black' : 'bg-gray-200 dark:bg-gray-700 border-2 border-black/10'} transition-all duration-300"></div>
                <div class="h-3 w-${current === 2 ? '8' : '3'} rounded-full ${current === 2 ? 'bg-[#f9d006] border-2 border-black' : 'bg-gray-200 dark:bg-gray-700 border-2 border-black/10'} transition-all duration-300"></div>
                <div class="h-3 w-${current === 3 ? '8' : '3'} rounded-full ${current === 3 ? 'bg-[#f9d006] border-2 border-black' : 'bg-gray-200 dark:bg-gray-700 border-2 border-black/10'} transition-all duration-300"></div>
            </div>
        `;

        const titleSection = (html) => `
            <div class="mt-6 mb-4 text-center shrink-0">
                ${html}
            </div>
        `;

        const buttons = (step, nextFn, skipFn) => `
             <div class="flex flex-col gap-3 mt-auto shrink-0 w-full pt-4">
                <button onclick="${nextFn}" class="neo-brutalist-btn w-full bg-[#f9d006] py-4 rounded-xl flex items-center justify-center border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                    <span class="text-[#1c1a0d] text-xl font-black uppercase tracking-widest">${step === 3 ? '立即開始' : '下一步'}</span>
                </button>
                <button onclick="${skipFn}" class="w-full py-2 flex items-center justify-center">
                    <span class="text-gray-500 dark:text-gray-400 text-sm font-bold underline decoration-2 underline-offset-4 cursor-pointer hover:text-black dark:hover:text-white">
                        ${step === 3 ? '返回上一步' : '跳過導覽'}
                    </span>
                </button>
            </div>
        `;

        let content = '';
        let middleContent = '';
        let headerContent = '';

        // Define content for each step
        if (step === 1) {
            headerContent = `
                <h1 class="text-black dark:text-white tracking-tight text-[32px] font-black leading-tight">
                    👋 歡迎來到<br/> <span class="text-[32px]">iPas AI應用規劃師</span>
                </h1>
                <h2 class="text-black dark:text-white text-[32px] font-black italic leading-tight mt-1">
                    “考證班”
                </h2>
            `;

            middleContent = `
                <div class="neo-brutalist-card bg-white dark:bg-[#2d2d2d] rounded-2xl w-full p-6 flex flex-col items-center border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-full overflow-y-auto justify-center">
                    <div class="flex items-center justify-between w-full mb-8 shrink-0">
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-14 h-14 bg-[#f9d006] rounded-xl border-[3px] border-black flex items-center justify-center">
                                <span class="material-symbols-outlined text-3xl font-black text-black">auto_fix_high</span>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-tighter text-black dark:text-white">Generate</span>
                        </div>
                        <span class="material-symbols-outlined text-black dark:text-white font-black">arrow_forward</span>
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-14 h-14 bg-white dark:bg-gray-100 border-[3px] border-black rounded-xl flex items-center justify-center text-black">
                                <span class="material-symbols-outlined text-3xl font-black">lightbulb</span>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-tighter text-black dark:text-white">Learn</span>
                        </div>
                        <span class="material-symbols-outlined text-black dark:text-white font-black">arrow_forward</span>
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-14 h-14 bg-white dark:bg-gray-100 border-[3px] border-black rounded-xl flex items-center justify-center text-black">
                                <span class="material-symbols-outlined text-3xl font-black">fact_check</span>
                            </div>
                            <span class="text-[10px] font-black uppercase tracking-tighter text-black dark:text-white">Quiz</span>
                        </div>
                    </div>
                    <div class="text-center px-2">
                        <p class="text-black dark:text-white text-xl font-black leading-snug">
                            輸入術語即可生成專屬題目卡，透過比喻輕鬆記憶。
                        </p>
                    </div>
                </div>
            `;
        } else if (step === 2) {
            headerContent = `
                <h1 class="text-[#1c1a0d] dark:text-white tracking-tight text-[32px] font-bold leading-tight text-center">
                    ⚡ 挑戰等級巔峰!
                </h1>
            `;

            middleContent = `
                 <div class="neo-brutalist-card bg-white dark:bg-[#2d2919] rounded-xl w-full p-6 flex flex-col items-center gap-6 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-full overflow-y-auto justify-center">
                    <div class="relative flex flex-col items-center justify-center w-full py-2 shrink-0">
                        <div class="flex items-end gap-4 mb-4">
                            <div class="flex flex-col items-center gap-2">
                                <div class="w-14 h-14 bg-white dark:bg-gray-800 rounded-lg border-2 border-black flex items-center justify-center">
                                    <span class="material-symbols-outlined text-2xl font-bold text-gray-400">person</span>
                                </div>
                                <span class="text-xs font-black bg-black text-white px-2 py-0.5 rounded">Lv.1</span>
                            </div>
                            <div class="mb-5">
                                <span class="material-symbols-outlined text-black dark:text-white text-2xl font-black">double_arrow</span>
                            </div>
                            <div class="flex flex-col items-center gap-2">
                                <div class="w-20 h-20 bg-[#f9d006] rounded-lg border-4 border-black flex items-center justify-center relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <span class="material-symbols-outlined text-4xl font-bold text-black fill-1">stars</span>
                                    <div class="absolute -top-3 -right-3 bg-red-500 text-white text-[9px] font-black px-1 border-2 border-black rotate-12">UP!</div>
                                </div>
                                <span class="text-sm font-black bg-[#f9d006] text-black px-3 py-0.5 border-2 border-black rounded">Lv.2</span>
                            </div>
                        </div>
                        <div class="w-full h-6 bg-white dark:bg-[#1a1810] border-2 border-black rounded-lg overflow-hidden relative">
                            <div class="absolute inset-y-0 left-0 bg-[#f9d006] border-r-2 border-black w-full flex items-center justify-center">
                                <span class="text-[9px] font-black text-black">XP 200/200</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-[#1c1a0d] dark:text-white text-lg font-bold leading-tight">
                            解鎖進階挑戰<br/>
                            <span class="text-gray-600 dark:text-gray-400 text-sm mt-1 inline-block font-medium">等級越高，權限越大</span>
                        </p>
                    </div>
                    <div class="px-2">
                         <p class="text-[#1c1a0d] dark:text-gray-200 text-sm font-medium leading-relaxed text-center opacity-80">
                            完成測驗並累積 XP 提升等級，解鎖更多成就勳章。
                        </p>
                    </div>
                </div>
            `;
        } else if (step === 3) {
            headerContent = `
                <h1 class="text-[#1c1a0d] dark:text-white tracking-tight text-[32px] font-bold leading-tight text-center">
                    🚀 開始學習旅程!
                </h1>
            `;

            middleContent = `
                <div class="neo-brutalist-card bg-white dark:bg-[#2d2919] rounded-2xl w-full p-6 flex flex-col items-center gap-6 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-full overflow-y-auto justify-center">
                    <div class="relative w-full flex items-center justify-center shrink-0">
                        <div class="relative w-48 h-40 bg-white dark:bg-[#3a3525] border-[3px] border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div class="w-full h-8 bg-[#f9d006] border-b-[3px] border-black flex items-center px-3 justify-between">
                                <span class="text-[10px] font-black tracking-widest uppercase text-black">TERM PREVIEW</span>
                                <div class="flex gap-1">
                                    <div class="w-1.5 h-1.5 rounded-full bg-black"></div>
                                    <div class="w-1.5 h-1.5 rounded-full bg-black"></div>
                                </div>
                            </div>
                            <div class="p-3 flex flex-col gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="material-symbols-outlined text-xl font-bold text-black dark:text-white">api</span>
                                    <span class="text-xl font-black text-black dark:text-white">API</span>
                                </div>
                                <div class="w-full h-[2px] bg-black/10 dark:bg-white/10 mt-0"></div>
                                <div class="flex flex-col gap-1.5 mt-0.5">
                                    <div class="h-1.5 w-3/4 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                                    <div class="h-1.5 w-full bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                                    <div class="h-1.5 w-1/2 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                                </div>
                            </div>
                            <div class="absolute -top-3 -right-3 bg-[#4ECDC4] border-[3px] border-black p-1.5 rounded-lg flex flex-col items-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <span class="material-symbols-outlined text-[16px] leading-none text-black font-bold">psychology</span>
                                <span class="text-[8px] font-black text-black leading-none mt-0.5">100%</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-center">
                        <p class="text-[#1c1a0d] dark:text-white text-lg font-black leading-tight">
                            打造專屬術語庫<br/>
                             <span class="text-gray-600 dark:text-gray-400 text-sm mt-1 inline-block font-medium">讓學習成果看得見</span>
                        </p>
                    </div>
                     <div class="px-2">
                         <p class="text-[#1c1a0d] dark:text-gray-200 text-sm font-medium leading-relaxed text-center opacity-80">
                            準備好征服程式術語了嗎？<br/>立刻開始建立你的第一張卡片！
                        </p>
                    </div>
                </div>
            `;
        }

        // Full one-page structure
        overlay.innerHTML = `
            <div class="relative flex h-[100dvh] w-full max-w-[430px] mx-auto flex-col overflow-hidden px-6 pt-12 pb-8">
                <!-- Top Indicator (Fixed) -->
                <div class="shrink-0 flex items-center justify-center">
                   ${indicators(step)}
                </div>

                <!-- Title (Fixed) -->
                ${titleSection(headerContent)}

                <!-- Middle Content (Flexible) -->
                <div class="flex-1 w-full min-h-0 flex flex-col justify-center py-2">
                    ${middleContent}
                </div>

                <!-- Bottom Buttons (Fixed) -->
                ${buttons(step, step === 3 ? 'OnboardingSystem.close()' : 'OnboardingSystem.nextStep()', step === 3 ? 'OnboardingSystem.prevStep()' : 'OnboardingSystem.close()')}
            </div>
        `;
    },

    nextStep() {
        if (this.currentStep < 3) {
            this.currentStep++;
            this.renderStep(this.currentStep);
        }
    },

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderStep(this.currentStep);
        }
    }
};

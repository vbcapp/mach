export default function Home() {
  return (
    <div className="bg-background-light dark:bg-background-dark text-[#1a1a1a] dark:text-white min-h-screen pb-32 font-display">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-light dark:bg-background-dark border-b-2 border-black px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-primary neo-border p-1 flex items-center justify-center">
            <span className="material-symbols-outlined text-black font-bold">terminal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase italic">VIBECODING</h1>
        </div>
        <button className="w-10 h-10 neo-border flex items-center justify-center bg-primary text-black neo-shadow-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all">
          <span className="material-symbols-outlined font-bold">add</span>
        </button>
      </header>

      {/* Level Card */}
      <div className="mx-4 mt-4 bg-black border-[3px] border-primary p-4 flex items-center gap-4">
        <div className="w-16 h-16 border-[3px] border-primary flex items-center justify-center bg-black flex-shrink-0">
          <div className="w-10 h-10 bg-primary relative overflow-hidden">
            <div className="absolute top-1 left-1 right-1 h-3 bg-black"></div>
            <div className="absolute bottom-4 left-2 w-1.5 h-1.5 bg-black"></div>
            <div className="absolute bottom-4 right-2 w-1.5 h-1.5 bg-black"></div>
            <div className="absolute bottom-1.5 left-3 right-3 h-1 bg-black"></div>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-end justify-between">
            <div className="text-primary text-2xl font-black italic tracking-tighter leading-none">Lv. 12</div>
            <div className="text-[12px] font-bold text-primary italic pr-1">95/100</div>
          </div>
          <div className="w-full h-2 border border-zinc-600 bg-zinc-900 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: "60%" }}></div>
          </div>
          <div className="text-[10px] font-bold text-white tracking-widest uppercase opacity-80">NEXT LEVEL: 200 XP</div>
        </div>
      </div>

      <main className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">單字卡庫</h2>
          <span className="text-[10px] font-bold opacity-50 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 neo-border">24 CARDS</span>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input className="w-full h-12 neo-border-thick px-10 bg-white dark:bg-zinc-800 focus:outline-none text-sm font-bold" placeholder="搜尋術語..." type="text" />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl">search</span>
          </div>
          <button className="w-12 h-12 neo-border-thick bg-white dark:bg-zinc-800 flex items-center justify-center neo-shadow-sm active:shadow-none active:translate-x-[1px] active:translate-y-[1px]">
            <span className="material-symbols-outlined">tune</span>
          </button>
        </div>

        {/* Filter Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button className="flex-none px-4 py-2 neo-border-thick bg-white dark:bg-zinc-800 font-bold text-xs neo-shadow-sm">不記得卡</button>
          <button className="flex-none px-5 py-2 neo-border-thick bg-primary font-black text-xs neo-shadow-sm">Lv.1</button>
          <button className="flex-none px-5 py-2 neo-border-thick bg-white dark:bg-zinc-800 font-bold text-xs neo-shadow-sm">Lv.2</button>
          <button className="flex-none px-5 py-2 neo-border-thick bg-white dark:bg-zinc-800 font-bold text-xs neo-shadow-sm">Lv.3</button>
          <button className="flex-none px-5 py-2 neo-border-thick bg-white dark:bg-zinc-800 font-bold text-xs neo-shadow-sm">Lv.4</button>
          <button className="flex-none px-5 py-2 neo-border-thick bg-white dark:bg-zinc-800 font-bold text-xs neo-shadow-sm">Lv.5</button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col min-h-[140px] relative">
            <div className="mb-2">
              <span className="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">Backend</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1">API</h3>
              <p className="text-[10px] leading-tight opacity-70 line-clamp-2">應用程式介面。定義不同組件互動規範。</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <span className="material-symbols-outlined text-base cursor-pointer hover:text-primary">edit_square</span>
              <span className="material-symbols-outlined text-base cursor-pointer text-red-500">delete</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col min-h-[140px] relative">
            <div className="mb-2">
              <span className="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">Frontend</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1">DOM</h3>
              <p className="text-[10px] leading-tight opacity-70 line-clamp-2">文件物件模型。HTML 文件的結構化表示。</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <span className="material-symbols-outlined text-base cursor-pointer hover:text-primary">edit_square</span>
              <span className="material-symbols-outlined text-base cursor-pointer text-red-500">delete</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col min-h-[140px] relative">
            <div className="mb-2">
              <span className="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">JS</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1">Closure</h3>
              <p className="text-[10px] leading-tight opacity-70 line-clamp-2">閉包。函式及其引用的周圍環境組合。</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <span className="material-symbols-outlined text-base cursor-pointer hover:text-primary">edit_square</span>
              <span className="material-symbols-outlined text-base cursor-pointer text-red-500">delete</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-zinc-900 neo-border-thick neo-shadow p-3 flex flex-col min-h-[140px] relative">
            <div className="mb-2">
              <span className="bg-primary neo-border px-1.5 py-0.5 text-[8px] font-bold uppercase">Lib</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black italic tracking-tighter uppercase leading-tight mb-1">React</h3>
              <p className="text-[10px] leading-tight opacity-70 line-clamp-2">用於構建使用者介面的 JavaScript 庫。</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <span className="material-symbols-outlined text-base cursor-pointer hover:text-primary">edit_square</span>
              <span className="material-symbols-outlined text-base cursor-pointer text-red-500">delete</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white dark:bg-zinc-900 border-t-2 border-black flex items-center justify-around px-6 z-50">
        <a className="flex flex-col items-center gap-1 group relative h-full justify-center" href="#">
          <div className="w-16 h-12 bg-primary neo-border-thick flex items-center justify-center neo-shadow-sm absolute -top-4">
            <span className="material-symbols-outlined text-black font-bold text-3xl">style</span>
          </div>
          <span className="text-xs font-bold text-black dark:text-white mt-10">學習卡</span>
        </a>
        <a className="flex flex-col items-center gap-1 group h-full justify-center" href="#">
          <span className="material-symbols-outlined text-3xl text-black dark:text-white">bar_chart</span>
          <span className="text-xs font-bold text-black dark:text-white">排行榜</span>
        </a>
        <a className="flex flex-col items-center gap-1 group h-full justify-center" href="#">
          <span className="material-symbols-outlined text-3xl text-black dark:text-white">settings</span>
          <span className="text-xs font-bold text-black dark:text-white">設定</span>
        </a>
      </nav>
    </div>
  );
}

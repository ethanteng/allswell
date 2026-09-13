export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const mark = tone === 'dark' ? 'bg-ink text-sage-100' : 'bg-sage-100 text-ink';

  return (
    <span className="flex items-center gap-2">
      <span className={`grid h-8 w-8 place-items-center rounded-[10px_10px_10px_3px] text-sm font-bold ${mark}`}>A</span>
      <span className="text-lg font-semibold tracking-[-0.03em]">Allswell</span>
    </span>
  );
}

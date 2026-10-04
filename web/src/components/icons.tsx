/** Small decorative line icons (24×24 viewBox, stroke = currentColor). */
function Icon({ d, size = 16 }: { d: string[]; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {d.map((path) => (
        <path key={path} d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

export const PencilIcon = () => <Icon d={['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z']} />;
export const LockIcon = () => <Icon size={14} d={['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z', 'M8 11V7a4 4 0 0 1 8 0v4']} />;
export const ShieldIcon = () => <Icon d={['M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z', 'm9 12 2 2 4-4']} />;
export const CrossIcon = () => <Icon size={22} d={['M18 6 6 18', 'm6 6 12 12']} />;
export const ChevronIcon = () => <Icon d={['m9 6 6 6-6 6']} />;

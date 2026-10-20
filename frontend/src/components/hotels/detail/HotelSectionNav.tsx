import { cn } from '../../../lib/utils';

export interface PageSection {
  id: string;
  label: string;
}

interface HotelSectionNavProps {
  sections: readonly PageSection[];
  activeId: string;
  onSelect: (id: string) => void;
}

/** Thanh tab cố định theo thứ tự các phần */
export function HotelSectionNav({ sections, activeId, onSelect }: HotelSectionNavProps) {
  return (
    <div className="sticky top-[var(--header-height)] z-30 bg-surface/95 backdrop-blur-md border-y border-border mt-3">
      <div className="page-container flex items-center justify-between">
        <nav aria-label="Các phần của trang" className="flex items-center space-x-8 overflow-x-auto no-scrollbar py-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => onSelect(section.id)}
              aria-current={activeId === section.id ? 'location' : undefined}
              className={cn(
                'py-4 border-b-2 text-sm transition-all whitespace-nowrap',
                activeId === section.id ? 'border-primary text-primary font-semibold' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

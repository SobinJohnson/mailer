import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ currentPage, totalPages, totalResults, onPageChange }: PaginationControlsProps) {
  if (totalResults === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20 gap-3 flex-wrap">
      <div className="text-[12px] text-muted-foreground">
        <span className="hidden sm:inline">Page </span>
        <span className="font-medium text-foreground">{currentPage}</span>
        <span className="text-muted-foreground/60"> / {totalPages}</span>
        <span className="mx-2 hidden sm:inline">·</span>
        <span className="font-medium text-foreground hidden sm:inline">{totalResults}</span>
        <span className="text-muted-foreground hidden sm:inline"> records</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-2 text-[12px]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Previous</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-2 text-[12px]"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

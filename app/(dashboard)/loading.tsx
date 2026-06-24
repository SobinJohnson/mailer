import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function DashboardSubPageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40 rounded-[8px]" />
          <Skeleton className="h-4 w-56 rounded-[6px] mt-2" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Skeleton className="h-9 w-24 rounded-[8px]" />
          <Skeleton className="h-9 w-28 rounded-[8px]" />
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <Skeleton className="h-8 w-full max-w-[300px] rounded-[6px]" />
          <Skeleton className="h-4 w-16 rounded-[4px] ml-auto" />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-secondary/20">
              <TableHead className="w-1/4 h-10"><Skeleton className="h-3 w-16 rounded" /></TableHead>
              <TableHead className="w-1/4 h-10"><Skeleton className="h-3 w-16 rounded" /></TableHead>
              <TableHead className="w-1/4 h-10"><Skeleton className="h-3 w-16 rounded" /></TableHead>
              <TableHead className="w-1/4 h-10 text-right"><Skeleton className="h-3 w-16 rounded ml-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="border-b border-border/60 last:border-0">
                <TableCell className="py-3.5"><Skeleton className="h-5 w-32 rounded" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="h-4 w-44 rounded" /></TableCell>
                <TableCell className="py-3.5"><Skeleton className="h-4 w-24 rounded" /></TableCell>
                <TableCell className="py-3.5 text-right"><Skeleton className="h-4 w-20 rounded ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* PaginationControls mock */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-border bg-secondary/10">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-16 rounded-[8px]" />
            <Skeleton className="h-8 w-16 rounded-[8px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

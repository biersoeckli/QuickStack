"use client"
import * as React from "react"

import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
    getPaginationRowModel,
    VisibilityState,
    getSortedRowModel,
    filterFns,
    FilterFnOption,
    PaginationState,
    TableState
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input";


import { DataTablePagination } from "@/components/ui/pagignation"
import { DataTableViewOptions } from "@/components/ui/column-toggle"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
}

export function DefaultDataTable<TData, TValue>({
    columns,
    data,
    globalFilterFn,
    hideSearchBar = false,
    initialTableState,
    onRowSelectionUpdate,
    onTableStateChanged
}: DataTableProps<TData, TValue> & {
    hideSearchBar?: boolean;
    onRowSelectionUpdate?: (selectedItems: TData[]) => void;
    onTableStateChanged?: (state: Partial<TableState>) => void;
    initialTableState?: Partial<TableState>;
    globalFilterFn?: FilterFnOption<any> | undefined;
}) {
    const [sorting, setSorting] = React.useState<SortingState>(initialTableState?.sorting ?? []);
    const [globalFilter, setGlobalFilter] = React.useState<any>(initialTableState?.globalFilter ?? []);
    const [pagination, setPagination] = React.useState<PaginationState>(initialTableState?.pagination ?? {
        pageSize: 10,
        pageIndex: 0
    });

    const [rowSelection, setRowSelection] = React.useState<any>({});
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const initialVisabilityState = columns.reduce((acc, col) => {
        const accessorKey = (col as any).accessorKey;
        if (!accessorKey) {
            return acc;
        }
        const valueOfInitialState = initialTableState?.columnVisibility?.[accessorKey];
        acc[accessorKey] = valueOfInitialState ?? !!(col as any).isVisible;
        return acc;
    }, {} as VisibilityState);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialVisabilityState);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        enableGlobalFilter: true,
        globalFilterFn: globalFilterFn ?? filterFns.includesString,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            rowSelection,
            pagination
        },
    });

    React.useEffect(() => {
        if (onRowSelectionUpdate) {
            const indexes = Object.keys(rowSelection).filter(key => Boolean(rowSelection[key] as boolean)).map(key => parseInt(key));
            // the core row model contains all unfilteres rows, the indexes wich are given by the rowSelection are the indexes of the core row model
            const values = table.getCoreRowModel().rows.map(row => row.original);
            onRowSelectionUpdate(values.filter((_, index) => indexes.includes(index)));
        }
    }, [onRowSelectionUpdate, rowSelection, table]);

    React.useEffect(() => {
        if (onTableStateChanged) {
            onTableStateChanged({
                sorting,
                pagination,
                globalFilter,
                columnVisibility
            })
        }
    }, [sorting, columnVisibility, globalFilter, pagination, onTableStateChanged]);

    return (
        <div>
            <div className="flex items-center py-4">
                {!hideSearchBar && <Input
                    placeholder="Search..."
                    value={globalFilter ?? ""}
                    onChange={(event: any) =>
                        table.setGlobalFilter(String(event.target.value))
                    }
                    className="max-w-sm"
                />}
                <DataTableViewOptions table={table} />

            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No elements to show.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="mt-4">
                <DataTablePagination table={table}/>
            </div>
        </div>
    )
}

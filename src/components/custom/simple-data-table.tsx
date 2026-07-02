"use client"

import { ColumnDef, Row, TableState } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/column-header"
import { ReactNode, useEffect, useState } from "react"
import { DefaultDataTable } from "./default-data-table"
import { usePathname, useRouter } from "next/navigation"
import FullLoadingSpinner from "../ui/full-loading-spinnter"
import { ReactNodeUtils } from "@/shared/utils/react-node.utils"
import { Checkbox } from "../ui/checkbox"

export function SimpleDataTable<TData>({
    tableIdentifier,
    columns,
    data,
    actionCol,
    onItemClick,
    onItemClickLink,
    hideSearchBar = false,
    showSelectCheckbox = false,
    onRowSelectionUpdate,
    columnFilters,
}: {
    tableIdentifier?: string,
    columns: ([string, string, boolean, (item: TData) => ReactNode] | [string, string, boolean])[],
    data: TData[],
    hideSearchBar?: boolean,
    showSelectCheckbox?: boolean,
    onItemClick?: (selectedItem: TData) => void,
    onItemClickLink?: (selectedItem: TData) => string,
    actionCol?: (selectedItem: TData) => ReactNode,
    onRowSelectionUpdate?: (selectedItems: TData[]) => void
    columnFilters?: {
        accessorKey: string,
        filterLabel: string,
        filterFunction: (item: TData) => boolean
    }[]
}) {

    const router = useRouter();
    const pathName = usePathname();
    const [columnInputData, setColumnInputData] = useState<TData[] | undefined>(undefined);
    const [initialTableState, setInitialTableState] = useState<Partial<TableState> | undefined>(undefined);

    const onTableStateChange = (newState: Partial<TableState>) => {
        const tableState = {
            columnVisibility: newState.columnVisibility,
            sorting: newState.sorting,
            paginationPageSize: newState.pagination?.pageSize
        };
        window.localStorage.setItem(`table-${tableIdentifier ?? pathName}`, JSON.stringify(tableState));
        window.sessionStorage.setItem(`table-${tableIdentifier ?? pathName}`, JSON.stringify({
            globalFilter: newState.globalFilter,
            paginationPageIndex: newState.pagination?.pageIndex
        }));
    }

    useEffect(() => {
        const outData = data.map((item) => {
            for (const [accessorKey, , , customRowDefinition] of columns) {
                if (!customRowDefinition) {
                    continue;
                }
                (item as any)[accessorKey + '_generated'] = customRowDefinition(item);
            }
            return item;
        });
        setColumnInputData(outData);

        const configJsonFromLocalstorage = window.localStorage.getItem(`table-${tableIdentifier ?? pathName}`);
        const configJsonFromSessionstorage = window.sessionStorage.getItem(`table-${tableIdentifier ?? pathName}`);
        const configFromLocalStorage = JSON.parse(configJsonFromLocalstorage ?? '{}');
        const configFromSessionStorage = JSON.parse(configJsonFromSessionstorage ?? '{}');
        const mergedConfig = {
            columnVisibility: configFromLocalStorage.columnVisibility,
            sorting: configFromLocalStorage.sorting,
            globalFilter: configFromSessionStorage.globalFilter,
            pagination: {
                pageSize: configFromLocalStorage.paginationPageSize ?? 10,
                pageIndex: configFromSessionStorage.paginationPageIndex ?? 0
            }
        };
        setInitialTableState(mergedConfig);

    }, [data, columns, tableIdentifier, pathName]);

    if (!columnInputData || !initialTableState) {
        return <FullLoadingSpinner />;
    }

    const globalFilterFn = (row: Row<TData>, columnHeaderNameNotWorking: string, searchTerm: string) => {
        if (!searchTerm || Array.isArray(searchTerm)) {
            return true;
        }
        const allCellValues = row.getAllCells().map(cell => {
            const headerName = cell.column.id;
            // if there is a custom column definition --> use it for filtering
            const columnDefinitionForFilter = columns.find(col => col[0] === headerName);
            if (columnDefinitionForFilter && columnDefinitionForFilter[3]) {
                const columnValue = columnDefinitionForFilter[3](row.original);
                const text = ReactNodeUtils.getTextFromReactElement(columnValue);
                if (typeof text === 'string') {
                    return text.toLowerCase();
                }
            }
            // use default column value for filtering
            return String(cell.getValue() ?? '').toLowerCase();
        });
        return allCellValues.join(' ').includes(searchTerm.toLowerCase());
    };

    const indexOfFirstVisibleColumn = columns.findIndex((column) => column[2]);
    const dataColumns = columns.map(([accessorKey, header, isVisible, customRowDefinition], columnIndex) => {

        const columnFiltersForThisColumn = columnFilters?.filter(filter => filter.accessorKey === accessorKey);

        const dataCol = {
            accessorKey,
            isVisible,
            headerName: header,
            filterFn: (row, columnName, searchTerm) => {
                if (searchTerm === undefined || searchTerm === null || searchTerm === '') {
                    return true;
                }
                if (columnFiltersForThisColumn && columnFiltersForThisColumn.length > 0) {
                    if (Array.isArray(searchTerm)) {
                        return columnFiltersForThisColumn
                            .filter(filter => searchTerm.includes(`${filter.accessorKey}_${filter.filterLabel}`))
                            .some(filter => filter.filterFunction(row.original));
                    }
                    return columnFiltersForThisColumn.some(filter => filter.filterFunction(row.original));
                } else {
                    let columnValue = customRowDefinition
                        ? customRowDefinition(row.original)
                        : (row.original as any)[accessorKey] as unknown as string | ReactNode;

                    columnValue = ReactNodeUtils.getTextFromReactElement((columnValue ?? ''));
                    if (typeof columnValue === 'string') {
                        return columnValue.toLowerCase().includes(searchTerm.toLowerCase());
                    }
                }
                return false;
            },
            header: ({ column }: { column: any }) => header && (
                <DataTableColumnHeader disableSorting={!!customRowDefinition} column={column} title={header} filterOptions={columnFiltersForThisColumn} />
            )
        } as ColumnDef<TData>;

        if (customRowDefinition) {
            dataCol.cell = ({ row }) => customRowDefinition(row.original);
        }

        if (onItemClick && columnIndex === indexOfFirstVisibleColumn) {
            dataCol.cell = ({ row }) => {
                const item = row.original;
                return (
                    <div className="cursor-pointer" onClick={() => onItemClick(item)}>
                        {customRowDefinition ? customRowDefinition(item) : (row.original as any)[accessorKey] as unknown as string}
                    </div>
                );
            };
        }

        if (onItemClickLink && columnIndex === indexOfFirstVisibleColumn) {
            dataCol.cell = ({ row }) => {
                const item = row.original;
                return (
                    <div className="cursor-pointer" onClick={() => router.push(onItemClickLink(item))}>
                        {customRowDefinition ? customRowDefinition(item) : (row.original as any)[accessorKey] as unknown as string}
                    </div>
                );
            };
        }

        return dataCol;
    });

    const selectableColumns: ColumnDef<TData>[] = showSelectCheckbox ? [{
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    }] : [];

    const finalCols: ColumnDef<TData>[] = [
        ...selectableColumns,
        ...dataColumns
    ];

    if (actionCol) {
        finalCols.push({
            id: "actions",
            cell: ({ row }) => {
                const property = row.original;
                return actionCol(property);
            },
        });
    }

    return <DefaultDataTable
        initialTableState={initialTableState}
        onTableStateChanged={onTableStateChange}
        globalFilterFn={globalFilterFn}
        columns={finalCols}
        data={columnInputData}
        hideSearchBar={hideSearchBar}
        onRowSelectionUpdate={onRowSelectionUpdate} />
}

import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

interface TableSkeletonProps {
    columns: number;
    rows?: number;
    hasAvatar?: boolean;
}

export default function TableSkeleton({ columns, rows = 8, hasAvatar = false }: TableSkeletonProps) {
    return (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <Table>
                <TableHead>
                    <TableRow>
                        {Array.from({ length: columns }).map((_, i) => (
                            <TableCell key={i}>
                                <Skeleton variant="text" width={i === columns - 1 ? 40 : "70%"} height={20} />
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <TableRow key={rowIdx} sx={{ height: 56 }}>
                            {Array.from({ length: columns }).map((_, colIdx) => (
                                <TableCell key={colIdx}>
                                    {colIdx === 0 && hasAvatar ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <Skeleton variant="circular" width={32} height={32} />
                                            <Skeleton variant="text" width={120} height={20} />
                                        </div>
                                    ) : colIdx === columns - 1 ? (
                                        <Skeleton variant="circular" width={32} height={32} sx={{ ml: "auto" }} />
                                    ) : (
                                        <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} height={20} />
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
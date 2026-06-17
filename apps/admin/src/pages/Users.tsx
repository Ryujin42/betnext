import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Button, Card, Modal, Table, TableCell, TableHead, TableRow } from '@betnext/ui';
import {
  getUserRg,
  listUsers,
  suspendUser,
  unsuspendUser,
  type AdminUser,
  type PaginatedUsers,
  type RgProfile,
} from '../api/users';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatEur(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

export function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'unsuspend';
    user: AdminUser;
  } | null>(null);
  const [reason, setReason] = useState('');

  const usersQuery = useQuery<PaginatedUsers>({
    queryKey: ['admin', 'users', { page, search, sorting: sorting[0] }],
    queryFn: () =>
      listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        sortBy: (sorting[0]?.id as 'createdAt' | 'name' | 'email' | undefined) ?? 'createdAt',
        sortDir: sorting[0]?.desc ? 'desc' : 'asc',
      }),
  });

  const suspendMut = useMutation({
    mutationFn: (vars: { id: number; reason: string | null }) => suspendUser(vars.id, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmAction(null);
      setReason('');
    },
  });
  const unsuspendMut = useMutation({
    mutationFn: (id: number) => unsuspendUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmAction(null);
    },
  });

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      { accessorKey: 'id', header: 'ID', size: 60 },
      { accessorKey: 'name', header: 'Nom' },
      { accessorKey: 'email', header: 'Email' },
      {
        accessorKey: 'role',
        header: 'Rôle',
        cell: ({ getValue }) => (
          <span className="rounded-md bg-surface-200 px-2 py-0.5 text-xs">
            {String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Inscrit le',
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        id: 'status',
        header: 'Statut',
        cell: ({ row }) =>
          row.original.suspendedAt ? (
            <span className="rounded-md bg-danger-500/20 px-2 py-0.5 text-xs text-red-300">
              Suspendu
            </span>
          ) : (
            <span className="rounded-md bg-success-500/20 px-2 py-0.5 text-xs text-emerald-300">
              Actif
            </span>
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(row.original)}>
              Profil RG
            </Button>
            {row.original.suspendedAt ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConfirmAction({ type: 'unsuspend', user: row.original })}
              >
                Réactiver
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmAction({ type: 'suspend', user: row.original })}
              >
                Suspendre
              </Button>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: usersQuery.data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-50">Utilisateurs</h1>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <input
            type="search"
            placeholder="Recherche nom ou email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-72 rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-sm text-ink-50 focus:border-brand-500 focus:outline-none"
          />
          <div className="ml-auto text-xs text-ink-300">
            {total} utilisateur{total > 1 ? 's' : ''}
          </div>
        </div>

        <Table>
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableCell key={h.id} header>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && !usersQuery.isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-ink-300">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-300">
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
            </Button>
          </div>
        </div>
      </Card>

      {selected && <RgDrawer user={selected} onClose={() => setSelected(null)} />}

      <Modal
        open={!!confirmAction}
        onClose={() => {
          setConfirmAction(null);
          setReason('');
        }}
        title={
          confirmAction?.type === 'suspend'
            ? `Suspendre ${confirmAction.user.name} ?`
            : `Réactiver ${confirmAction?.user.name} ?`
        }
      >
        {confirmAction?.type === 'suspend' && (
          <div className="mb-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-300">Raison (optionnelle)</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Triche détectée, doute identité…"
                className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <p className="mt-3 text-xs text-ink-300">
              L'utilisateur ne pourra plus se connecter tant qu'un admin ne lèvera pas la
              suspension.
            </p>
          </div>
        )}
        {confirmAction?.type === 'unsuspend' && (
          <p className="mb-4 text-sm text-ink-300">
            L'utilisateur pourra à nouveau se connecter immédiatement.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmAction(null);
              setReason('');
            }}
          >
            Annuler
          </Button>
          {confirmAction?.type === 'suspend' ? (
            <Button
              variant="danger"
              loading={suspendMut.isPending}
              onClick={() => {
                if (confirmAction) {
                  suspendMut.mutate({ id: confirmAction.user.id, reason: reason || null });
                }
              }}
            >
              Confirmer la suspension
            </Button>
          ) : (
            <Button
              loading={unsuspendMut.isPending}
              onClick={() => {
                if (confirmAction) {
                  unsuspendMut.mutate(confirmAction.user.id);
                }
              }}
            >
              Confirmer la réactivation
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}

function RgDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const query = useQuery<RgProfile>({
    queryKey: ['admin', 'users', user.id, 'rg'],
    queryFn: () => getUserRg(user.id),
  });

  return (
    <Modal open onClose={onClose} title={`Profil RG — ${user.name}`} width="max-w-xl">
      {query.isLoading && <p className="text-sm text-ink-300">Chargement…</p>}
      {query.isError && <p className="text-sm text-red-300">Impossible de charger le profil RG.</p>}
      {query.data && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Limite mise / jour" value={formatEur(query.data.dailyBetLimit)} />
          <Field label="Limite mise / semaine" value={formatEur(query.data.weeklyBetLimit)} />
          <Field label="Limite dépôt / jour" value={formatEur(query.data.dailyDepositLimit)} />
          <Field label="Limite dépôt / semaine" value={formatEur(query.data.weeklyDepositLimit)} />
          <Field label="Dernière MAJ" value={formatDate(query.data.limitUpdatedAt)} />
          <Field
            label="Auto-exclusion jusqu'à"
            value={formatDate(query.data.selfExcludedUntil)}
            danger={!!query.data.selfExcludedUntil}
          />
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-300">{label}</div>
      <div className={`text-lg font-medium ${danger ? 'text-red-300' : 'text-ink-50'}`}>
        {value}
      </div>
    </div>
  );
}

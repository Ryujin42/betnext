import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, KpiCard } from '@betnext/ui';
import { useAuth } from '../auth/AuthContext';
import { listMyBets, type BetView } from '../api/bets';
import { getBalance, listTransactions, type Balance, type Transaction } from '../api/wallet';
import { getRgProfile, selfExclude, updateRgLimits, type RgProfile } from '../api/rg';
import { ApiException } from '../api/client';

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En cours',
  WON: 'Gagné',
  LOST: 'Perdu',
  CANCELLED: 'Annulé',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-surface-300 text-ink-300',
  WON: 'bg-success-500/20 text-emerald-300',
  LOST: 'bg-danger-500/20 text-red-300',
  CANCELLED: 'bg-surface-200 text-ink-300',
};

const TX_LABEL: Record<string, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  BET: 'Mise',
  WIN: 'Gain',
  REFUND: 'Remboursement',
};

export function ProfilePage() {
  const { user } = useAuth();

  const balanceQ = useQuery<Balance>({ queryKey: ['wallet', 'balance'], queryFn: getBalance });
  const betsQ = useQuery<BetView[]>({ queryKey: ['bets', 'mine'], queryFn: listMyBets });
  const txQ = useQuery<Transaction[]>({
    queryKey: ['wallet', 'transactions'],
    queryFn: listTransactions,
  });
  const rgQ = useQuery<RgProfile>({ queryKey: ['rg', 'profile'], queryFn: getRgProfile });

  const stats = useMemo(() => computeStats(betsQ.data ?? []), [betsQ.data]);
  const gainSeries = useMemo(() => buildGainSeries(betsQ.data ?? []), [betsQ.data]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-ink-50">{user?.name ?? 'Mon profil'}</h1>
        <p className="mt-1 text-sm text-ink-300">{user?.email}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Solde"
          value={balanceQ.data ? formatEur(balanceQ.data.amount) : '—'}
          delta="Disponible"
        />
        <KpiCard
          label="Total misé"
          value={formatEur(stats.totalStaked)}
          delta={`${stats.totalBets} paris`}
        />
        <KpiCard
          label="Total gagné"
          value={formatEur(stats.totalWon)}
          delta={`${stats.bilan >= 0 ? '+' : ''}${formatEur(stats.bilan)} net`}
        />
        <KpiCard
          label="Taux de réussite"
          value={`${stats.winRate.toFixed(0)} %`}
          delta={`${stats.wonCount} / ${stats.resolvedCount} résolus`}
        />
      </div>

      {gainSeries.length > 1 && (
        <Card title="Évolution du bilan" hint="Cumulé sur tes paris résolus">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gainSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232c45" />
                <XAxis dataKey="label" tick={{ fill: '#98a2bd', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: '#98a2bd', fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}€`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#11172a',
                    border: '1px solid #232c45',
                    borderRadius: 8,
                    color: '#e3e7f1',
                  }}
                  labelStyle={{ color: '#98a2bd' }}
                  formatter={(v: number) => [formatEur(v), 'Bilan']}
                />
                <Line type="monotone" dataKey="cum" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Historique des paris" hint={`${betsQ.data?.length ?? 0} paris`}>
        {betsQ.data && betsQ.data.length === 0 && (
          <p className="text-sm text-ink-300">Tu n'as pas encore placé de pari.</p>
        )}
        <ul className="flex flex-col gap-2">
          {(betsQ.data ?? []).slice(0, 20).map((bet) => (
            <li
              key={bet.id}
              className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 p-3"
            >
              <div>
                <div className="font-medium text-ink-50">{bet.outcomeLabel}</div>
                <div className="text-xs text-ink-300">
                  {bet.eventName} · {formatDate(bet.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-ink-300">Mise → Gain</div>
                  <div className="font-medium text-ink-50">
                    {formatEur(bet.amount)} →{' '}
                    {bet.actualGain !== null
                      ? formatEur(bet.actualGain)
                      : formatEur(bet.potentialGain)}
                  </div>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLORS[bet.status] ?? ''}`}
                >
                  {STATUS_LABEL[bet.status] ?? bet.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Transactions récentes" hint={`${txQ.data?.length ?? 0} mouvements`}>
        <ul className="flex flex-col gap-2">
          {(txQ.data ?? []).slice(0, 15).map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm"
            >
              <div>
                <div className="font-medium text-ink-50">{TX_LABEL[tx.type] ?? tx.type}</div>
                <div className="text-xs text-ink-300">
                  {tx.description ?? formatDate(tx.createdAt)}
                </div>
              </div>
              <div
                className={`font-semibold ${tx.type === 'BET' || tx.type === 'WITHDRAWAL' ? 'text-red-300' : 'text-emerald-300'}`}
              >
                {tx.type === 'BET' || tx.type === 'WITHDRAWAL' ? '−' : '+'}
                {formatEur(tx.amount)}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <RgPanel rg={rgQ.data} />
    </div>
  );
}

function computeStats(bets: BetView[]) {
  const totalStaked = bets.reduce((sum, b) => sum + (b.status === 'CANCELLED' ? 0 : b.amount), 0);
  const wonBets = bets.filter((b) => b.status === 'WON');
  const totalWon = wonBets.reduce((sum, b) => sum + (b.actualGain ?? 0), 0);
  const resolvedCount = bets.filter((b) => b.status === 'WON' || b.status === 'LOST').length;
  return {
    totalBets: bets.length,
    totalStaked,
    totalWon,
    bilan: totalWon - totalStaked,
    wonCount: wonBets.length,
    resolvedCount,
    winRate: resolvedCount === 0 ? 0 : (wonBets.length / resolvedCount) * 100,
  };
}

function buildGainSeries(bets: BetView[]): Array<{ label: string; cum: number }> {
  const resolved = bets
    .filter((b) => b.status === 'WON' || b.status === 'LOST')
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let cum = 0;
  return resolved.map((b, idx) => {
    cum += (b.actualGain ?? 0) - b.amount;
    return { label: `#${idx + 1}`, cum: Number(cum.toFixed(2)) };
  });
}

function RgPanel({ rg }: { rg: RgProfile | undefined }) {
  const qc = useQueryClient();
  const updateMut = useMutation({
    mutationFn: updateRgLimits,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rg', 'profile'] }),
  });
  const excludeMut = useMutation({
    mutationFn: selfExclude,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rg', 'profile'] }),
  });

  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState('');
  const [weekly, setWeekly] = useState('');
  const [duration, setDuration] = useState('30');

  if (!rg) {
    return (
      <Card title="Jeu responsable">
        <p className="text-sm text-ink-300">Chargement de tes limites…</p>
      </Card>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const input: Parameters<typeof updateRgLimits>[0] = {};
    if (daily.trim() !== '') input.dailyBetLimit = Number(daily);
    if (weekly.trim() !== '') input.weeklyBetLimit = Number(weekly);
    if (Object.keys(input).length === 0) return;
    try {
      await updateMut.mutateAsync(input);
      setDaily('');
      setWeekly('');
    } catch (err) {
      if (err instanceof ApiException && err.body?.errorCode === 'RG_001') {
        setError(
          "Une hausse précédente est encore en attente (effet sous 48h) — patiente avant d'en demander une nouvelle.",
        );
        return;
      }
      setError(err instanceof ApiException ? (err.body?.message ?? 'Refusé') : 'Erreur réseau.');
    }
  };

  const onSelfExclude = async () => {
    setError(null);
    if (
      !window.confirm(
        `Confirmes-tu une auto-exclusion de ${duration} jours ? Cette décision est irréversible avant l'échéance.`,
      )
    ) {
      return;
    }
    try {
      await excludeMut.mutateAsync(Number(duration));
    } catch (err) {
      setError(err instanceof ApiException ? (err.body?.message ?? 'Refusé') : 'Erreur réseau.');
    }
  };

  return (
    <Card title="Jeu responsable" hint="Modifier mes limites">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <RgField label="Mise / jour" value={rg.dailyBetLimit} />
        <RgField label="Mise / semaine" value={rg.weeklyBetLimit} />
        <RgField label="Dépôt / jour" value={rg.dailyDepositLimit} />
        <RgField label="Dépôt / semaine" value={rg.weeklyDepositLimit} />
      </div>

      <p className="mt-4 text-xs text-ink-300">
        Une baisse est appliquée immédiatement. Une hausse n'est effective qu'après 48h
        (réglementation ARJEL).
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Nouvelle limite mise / jour (€)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-300">Nouvelle limite mise / semaine (€)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" loading={updateMut.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-3 rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <hr className="my-6 border-surface-200" />

      <div>
        <h3 className="text-sm font-semibold text-ink-100">Auto-exclusion</h3>
        <p className="mt-1 text-xs text-ink-300">
          Bloque ta connexion pendant la durée choisie. Décision irréversible avant l'échéance.
        </p>
        <div className="mt-3 flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-300">Durée (jours, 7 à 365)</span>
            <input
              type="number"
              min={7}
              max={365}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-32 rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <Button variant="danger" loading={excludeMut.isPending} onClick={onSelfExclude}>
            M'auto-exclure
          </Button>
        </div>
        {rg.selfExcludedUntil && (
          <p className="mt-3 rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">
            Auto-exclusion active jusqu'au {formatDate(rg.selfExcludedUntil)}.
          </p>
        )}
      </div>
    </Card>
  );
}

function RgField({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-300">{label}</div>
      <div className="text-lg font-semibold text-ink-50">
        {value === null ? 'Aucune' : formatEur(value)}
      </div>
    </div>
  );
}

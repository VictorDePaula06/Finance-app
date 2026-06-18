import { useMemo } from 'react';
import { useStore } from '../store.jsx';
import * as F from '../lib/finance.js';

// Deriva os números do app a partir dos dados reais do Firestore (mesmo banco do site).
export function useFinance() {
  const { transactions, savings_jars, cards, subscriptions, prefs, user } = useStore();

  return useMemo(() => {
    const monthKey = F.monthKeyNow();
    const basis = F.getExpenseBasis(prefs);
    const balance = F.buildWalletLedger(transactions, monthKey).finalBalance;
    const baseIncome = parseFloat(prefs?.manualConfig?.income) || 0;
    const incomeTx = F.monthIncome(transactions, monthKey);
    const income = incomeTx > 0 ? incomeTx : baseIncome;
    const expense = F.monthExpense(transactions, monthKey, basis);
    const reserve = F.reserveTotal(savings_jars);
    const invoice = F.computeInvoice(cards, subscriptions, transactions);
    const fixedExpenses = parseFloat(prefs?.manualConfig?.fixedExpenses) || 0;
    const health = F.computeHealth({ income, expense, reserve, fixedExpenses });

    return {
      monthKey, basis, balance, income, incomeTx, expense, reserve, invoice, health,
      transactions, cards, subscriptions, savings_jars, prefs, user,
    };
  }, [transactions, savings_jars, cards, subscriptions, prefs, user]);
}

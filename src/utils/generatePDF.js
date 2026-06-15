import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CATEGORIES } from '../constants/categories';

// Helper to load image as base64 for jsPDF
const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
};

export const generatePDF = async (data, logoSrc) => {
    const doc = new jsPDF();

    // --- Data Preparation ---
    // O relatório já vem calculado (fluxo de caixa) do PeriodAnalysis.
    const {
        monthKey,
        monthLabel,
        income = 0,
        expense = 0,
        balance = 0,
        byCategory = [],
        rows = [],
        reportTitle = 'RELATÓRIO MENSAL',
    } = data || {};

    // Linhas ordenadas por data (mais recente primeiro).
    const filtered = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));

    const formattedMonth = monthLabel ? monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) : monthKey;

    // --- PDF DRAWING ---

    // 1. Header & Logo
    // Background header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');

    // Logo (if available)
    if (logoSrc) {
        try {
            const logoImg = await loadImage(logoSrc);
            // Draw logo (adjust dimensions as needed)
            doc.addImage(logoImg, 'PNG', 14, 8, 12, 12); // Square logo approx

            // App Name
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("Alívia", 30, 16);
        } catch (e) {
            console.error("Erro ao carregar logo para PDF", e);
            // Fallback text if logo fails
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("Alívia", 14, 16);
        }
    } else {
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Alívia", 14, 16);
    }

    // Report Title
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont("helvetica", "normal");
    doc.text(reportTitle, 14, 28);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(formattedMonth, 14, 34);

    // Indicator of flow type
    doc.setFontSize(8);
    doc.setTextColor(52, 211, 153); // Emerald 400
    doc.setFont("helvetica", "bold");
    const flowText = "VISAO: FLUXO DE CAIXA";
    const textWidth = doc.getTextWidth(flowText);
    doc.text(flowText, 196 - textWidth, 34);

    // 2. Summary Cards
    const cardY = 50;
    const cardWidth = 58;
    const cardHeight = 24;
    const gap = 6;

    // Helper to draw card
    const drawCard = (x, title, value, colorType) => {
        // Colors
        const colors = {
            green: { bg: [240, 253, 244], border: [22, 163, 74], text: [22, 163, 74] }, // Emerald
            red: { bg: [254, 242, 242], border: [225, 29, 72], text: [225, 29, 72] }, // Rose
            blue: { bg: [239, 246, 255], border: [37, 99, 235], text: [37, 99, 235] }, // Blue
            neutral: { bg: [248, 250, 252], border: [148, 163, 184], text: [71, 85, 105] } // Slate
        };
        const c = colors[colorType];

        // Background
        doc.setDrawColor(...c.border);
        doc.setFillColor(...c.bg);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, 'FD');

        // Title
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text(title, x + 4, cardY + 8);

        // Value
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...c.text);
        doc.text(`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x + 4, cardY + 18);
    };

    // Card 1: Income
    drawCard(14, "Recebimentos", income, 'green');

    // Card 2: Expense
    drawCard(14 + cardWidth + gap, "Lançamentos", expense, 'red');

    // Card 3: Balance
    drawCard(14 + (cardWidth + gap) * 2, "Saldo Final", balance, balance >= 0 ? 'blue' : 'red');

    // --- CHART / CATEGORY BREAKDOWN ---
    const sortedCategories = byCategory
        .map(c => ({ id: c.id, label: c.label, amount: c.value }))
        .slice(0, 5); // Top 5

    if (sortedCategories.length > 0) {
        const startY = 85;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("TOP DESPESAS POR CATEGORIA", 14, startY);

        let currentY = startY + 5;
        const totalExpense = expense > 0 ? expense : 1; // Avoid division by zero

        sortedCategories.forEach(cat => {
            const percent = (cat.amount / totalExpense);
            const barWidth = 100 * percent; // Scale to 100mm max width

            // Label
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(cat.label, 14, currentY + 4);

            // Bar Background
            doc.setFillColor(241, 245, 249); // Slate 100
            doc.roundedRect(40, currentY, 100, 5, 2, 2, 'F');

            // Bar Fill
            // Simple color logic - could be improved with actual hex mapping
            // For now, let's use a nice standard color or try to parse
            doc.setFillColor(59, 130, 246); // Blue 500 default
            // Try to match category color if possible, else default
            if (cat.id === 'food') doc.setFillColor(249, 115, 22); // Orange
            if (cat.id === 'transport') doc.setFillColor(168, 85, 247); // Purple
            if (cat.id === 'housing') doc.setFillColor(239, 68, 68); // Red
            if (cat.id === 'leisure') doc.setFillColor(236, 72, 153); // Pink

            doc.roundedRect(40, currentY, barWidth, 5, 2, 2, 'F');

            // Value
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`R$ ${cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 150, currentY + 4);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`(${(percent * 100).toFixed(1)}%)`, 180, currentY + 4);

            currentY += 10;
        });

        // Push table down
        var tableStartY = currentY + 10;
    } else {
        var tableStartY = 85;
    }


    // 3. Transactions Table
    const tableColumn = ["DIA", "DESCRIÇÃO", "CATEGORIA", "TIPO", "VALOR"];
    const tableRows = filtered.map(t => {
        const catList = t.type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
        const foundCat = catList.find(c => c.id === t.category) || catList.find(c => c.id === 'other');

        // Fix: campo correto é `totalInstallments` (estava `installments`, sempre falsy → não mostrava parcelas no PDF)
        const desc = t.description || 'Sem descrição';
        const installmentSuffix = t.totalInstallments
            ? ` (${t.currentInstallment || 1}/${t.totalInstallments})`
            : '';
        return [
            new Date(t.date).getDate().toString().padStart(2, '0'), // Just the day
            desc + (t.isFixed ? ' (Fixa)' : '') + installmentSuffix,
            foundCat ? foundCat.label : 'Geral',
            t.type === 'income' ? 'Recebimento' : 'Lançamento',
            `R$ ${Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: tableStartY, // Use dynamic startY
        theme: 'striped',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: [51, 65, 85], // Slate 700
            valign: 'middle',
            lineColor: [226, 232, 240],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [30, 41, 59], // Slate 800
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 15 }, // Day
            1: { cellWidth: 'auto' }, // Desc
            2: { cellWidth: 30 }, // Category
            3: { halign: 'center', cellWidth: 20 }, // Type
            4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' } // Value
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // Slate 50
        },
        didParseCell: function (data) {
            // Colorize Value column
            if (data.section === 'body' && data.column.index === 4) {
                const rowIndex = data.row.index;
                const isIncome = filtered[rowIndex].type === 'income';
                if (isIncome) {
                    data.cell.styles.textColor = [22, 163, 74];
                } else {
                    data.cell.styles.textColor = [225, 29, 72];
                }
            }
        }
    });

    // 4. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(
            `Alívia - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
            14,
            doc.internal.pageSize.height - 10
        );
        doc.text(
            `Página ${i} de ${pageCount}`,
            doc.internal.pageSize.width - 24,
            doc.internal.pageSize.height - 10
        );
    }

    doc.save(`Relatorio_Alivia_${monthKey || 'periodo'}.pdf`);
};

// ════════════════════════════════════════════════════════════════════════
//  HELPERS REUTILIZÁVEIS — PDFs de tabela (Contas, Metas, Faturas, Histórico)
//  Todos no mesmo padrão visual da Alívia (cabeçalho slate + logo + rodapé).
// ════════════════════════════════════════════════════════════════════════

const fmtBRL = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const drawAliviaHeader = async (doc, { title, subtitle, badge }, logoSrc) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    let textX = 14;
    if (logoSrc) {
        try { const img = await loadImage(logoSrc); doc.addImage(img, 'PNG', 14, 8, 12, 12); textX = 30; } catch (e) { /* fallback */ }
    }
    doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('Alívia', textX, 16);
    doc.setFontSize(10); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text(String(title || '').toUpperCase(), 14, 28);
    if (subtitle) { doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.text(String(subtitle), 14, 34); }
    if (badge) {
        doc.setFontSize(8); doc.setTextColor(52, 211, 153); doc.setFont('helvetica', 'bold');
        const w = doc.getTextWidth(badge);
        doc.text(badge, 196 - w, 34);
    }
};

const drawAliviaFooter = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
        doc.text(`Alívia - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, doc.internal.pageSize.height - 10);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 24, doc.internal.pageSize.height - 10);
    }
};

const SUMMARY_COLORS = {
    green: { bg: [240, 253, 244], border: [22, 163, 74], text: [22, 163, 74] },
    red: { bg: [254, 242, 242], border: [225, 29, 72], text: [225, 29, 72] },
    blue: { bg: [239, 246, 255], border: [37, 99, 235], text: [37, 99, 235] },
    amber: { bg: [255, 251, 235], border: [217, 119, 6], text: [180, 83, 9] },
    violet: { bg: [245, 243, 255], border: [124, 58, 237], text: [124, 58, 237] },
    neutral: { bg: [248, 250, 252], border: [148, 163, 184], text: [71, 85, 105] },
};

const drawSummaryCards = (doc, summary, cardY = 50) => {
    const n = summary.length;
    if (!n) return cardY;
    const gap = 6;
    const totalW = 182;
    const cardWidth = (totalW - gap * (n - 1)) / n;
    const cardHeight = 24;
    summary.forEach((s, i) => {
        const x = 14 + i * (cardWidth + gap);
        const c = SUMMARY_COLORS[s.color] || SUMMARY_COLORS.neutral;
        doc.setDrawColor(...c.border); doc.setFillColor(...c.bg);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, 'FD');
        doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(String(s.label).toUpperCase(), x + 4, cardY + 8);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c.text);
        doc.text(String(s.value), x + 4, cardY + 18);
    });
    return cardY + cardHeight + 10;
};

/**
 * PDF genérico de tabela no padrão Alívia.
 * @param {object} opts
 *   title, subtitle, badge, fileName, note
 *   summary: [{ label, value, color }]
 *   columns: string[]
 *   rows: (string|number)[][]
 *   columnStyles, valueColumnIndex (pinta - em vermelho)
 */
export const generateTablePDF = async (opts, logoSrc) => {
    const {
        title = 'Relatório', subtitle = '', badge = '', fileName = 'Alivia.pdf',
        note = '', summary = [], columns = [], rows = [], columnStyles = {}, valueColumnIndex = null,
    } = opts || {};

    const doc = new jsPDF();
    await drawAliviaHeader(doc, { title, subtitle, badge }, logoSrc);

    let startY = summary.length ? drawSummaryCards(doc, summary) : 50;

    if (note) {
        doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(note, 182);
        doc.text(lines, 14, startY);
        startY += lines.length * 5 + 4;
    }

    if (columns.length) {
        autoTable(doc, {
            head: [columns], body: rows, startY, theme: 'striped',
            styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85], valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.1 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles,
            didParseCell: valueColumnIndex != null ? (data) => {
                if (data.section === 'body' && data.column.index === valueColumnIndex) {
                    const raw = String(data.cell.raw || '');
                    if (raw.trim().startsWith('-') || raw.trim().startsWith('−')) data.cell.styles.textColor = [225, 29, 72];
                    else data.cell.styles.textColor = [22, 163, 74];
                }
            } : undefined,
        });
    }

    drawAliviaFooter(doc);
    doc.save(fileName);
};

const hexToRgb = (hex) => {
    if (!hex) return [99, 102, 241];
    const m = String(hex).replace('#', '');
    const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const int = parseInt(n, 16);
    if (isNaN(int)) return [99, 102, 241];
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

/**
 * PDF dedicado da carteira de Investimentos (padrão Alívia).
 * @param {object} data
 *   userName, currency ('R$'|'$'), totalCurrent, totalInvested, profit, profitPct,
 *   totalReserve, totalPatrimonio,
 *   allocation: [{ label, value, color }],
 *   assets: [{ name, classLabel, invested, current, profit, profitPct }]
 */
export const generateInvestmentsPDF = async (data, logoSrc) => {
    const {
        userName = '', currency = 'R$',
        totalCurrent = 0, totalInvested = 0, profit = 0, profitPct = 0,
        totalReserve = 0, totalPatrimonio = 0,
        allocation = [], assets = [],
    } = data || {};

    const f = (v) => `${currency} ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const doc = new jsPDF();

    await drawAliviaHeader(doc, {
        title: 'Carteira de Investimentos',
        subtitle: userName ? `Investidor: ${userName}` : new Date().toLocaleDateString('pt-BR'),
        badge: `${assets.length} ${assets.length === 1 ? 'ativo' : 'ativos'}`,
    }, logoSrc);

    let y = drawSummaryCards(doc, [
        { label: 'Valor atual', value: f(totalCurrent), color: 'blue' },
        { label: 'Investido', value: f(totalInvested), color: 'neutral' },
        { label: 'Lucro / Prejuízo', value: `${profit >= 0 ? '+ ' : '- '}${f(Math.abs(profit))}`, color: profit >= 0 ? 'green' : 'red' },
        { label: 'Rentabilidade', value: `${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%`, color: profitPct >= 0 ? 'green' : 'red' },
    ]);

    // Linha extra: reserva + patrimônio total.
    doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
    doc.text(`Reserva de emergência: ${f(totalReserve)}    |    Patrimônio total (investimentos + reserva): ${f(totalPatrimonio)}`, 14, y);
    y += 8;

    // Alocação por classe (barras).
    if (allocation.length) {
        doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'bold');
        doc.text('ALOCAÇÃO POR CLASSE', 14, y); y += 6;
        const totalAlloc = allocation.reduce((a, c) => a + (c.value || 0), 0) || 1;
        allocation.forEach(c => {
            const pct = (c.value || 0) / totalAlloc;
            doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal');
            doc.text(c.label, 14, y + 4);
            doc.setFillColor(241, 245, 249); doc.roundedRect(50, y, 95, 5, 2, 2, 'F');
            doc.setFillColor(...hexToRgb(c.color)); doc.roundedRect(50, y, Math.max(1, 95 * pct), 5, 2, 2, 'F');
            doc.setFontSize(9); doc.setTextColor(30, 41, 59); doc.text(f(c.value), 150, y + 4);
            doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text(`(${(pct * 100).toFixed(1)}%)`, 184, y + 4);
            y += 9;
        });
        y += 4;
    }

    // Tabela de ativos.
    if (assets.length) {
        autoTable(doc, {
            head: [['Ativo', 'Classe', 'Investido', 'Atual', 'Resultado', '%']],
            body: assets.map(a => [
                a.name,
                a.classLabel,
                f(a.invested),
                f(a.current),
                `${a.profit >= 0 ? '+ ' : '- '}${f(Math.abs(a.profit))}`,
                `${a.profitPct >= 0 ? '+' : ''}${a.profitPct.toFixed(1)}%`,
            ]),
            startY: y, theme: 'striped',
            styles: { fontSize: 9, cellPadding: 3, textColor: [51, 65, 85], valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.1 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', cellWidth: 18 } },
            didParseCell: (d) => {
                if (d.section === 'body' && (d.column.index === 4 || d.column.index === 5)) {
                    const raw = String(d.cell.raw || '');
                    d.cell.styles.textColor = raw.includes('-') ? [225, 29, 72] : [22, 163, 74];
                }
            },
        });
    }

    drawAliviaFooter(doc);
    doc.save(`Investimentos_Alivia_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export { fmtBRL };

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

export const generatePDF = async (transactions, selectedMonth_YYYY_MM, logoSrc) => {
    const doc = new jsPDF();

    // --- Data Preparation ---
    // Filter transactions for the selected month
    const filtered = transactions.filter(t => {
        const tMonth = t.month ? t.month : t.date.slice(0, 7);
        return tMonth === selectedMonth_YYYY_MM;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Totals
    const income = filtered
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const expense = filtered
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const balance = income - expense;

    // Dates
    const [year, month] = selectedMonth_YYYY_MM.split('-');
    const dateObj = new Date(year, month - 1);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

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
            doc.text("Finance Control", 30, 16);
        } catch (e) {
            console.error("Erro ao carregar logo para PDF", e);
            // Fallback text if logo fails
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("Finance Control", 14, 16);
        }
    } else {
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Finance Control", 14, 16);
    }

    // Report Title
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont("helvetica", "normal");
    doc.text("RELATÓRIO MENSAL", 14, 28);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(formattedMonth, 14, 34);

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
    drawCard(14, "Entradas", income, 'green');

    // Card 2: Expense
    drawCard(14 + cardWidth + gap, "Saídas", expense, 'red');

    // Card 3: Balance
    drawCard(14 + (cardWidth + gap) * 2, "Saldo Final", balance, balance >= 0 ? 'blue' : 'red');

    // --- CHART / CATEGORY BREAKDOWN ---
    const categoryTotals = filtered
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
            const catId = t.category;
            if (!acc[catId]) {
                const catList = CATEGORIES.expense;
                const foundCat = catList.find(c => c.id === catId) || catList.find(c => c.id === 'other');
                acc[catId] = {
                    id: catId,
                    label: foundCat ? foundCat.label : 'Outro',
                    amount: 0,
                    color: foundCat ? foundCat.color.replace('text-', '') : 'slate-400' // rudimentary color mapping
                };
            }
            acc[catId].amount += Number(t.amount);
            return acc;
        }, {});

    const sortedCategories = Object.values(categoryTotals)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5); // Start with top 5

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

        return [
            new Date(t.date).getDate().toString().padStart(2, '0'), // Just the day
            t.description + (t.isFixed ? ' (Fixa)' : '') + (t.installments ? ` (${t.currentInstallment}/${t.installments})` : ''),
            foundCat ? foundCat.label : 'Geral',
            t.type === 'income' ? 'Entrada' : 'Saída',
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
            `Finance Control - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
            14,
            doc.internal.pageSize.height - 10
        );
        doc.text(
            `Página ${i} de ${pageCount}`,
            doc.internal.pageSize.width - 24,
            doc.internal.pageSize.height - 10
        );
    }

    doc.save(`Relatorio_Finance_Control_${selectedMonth_YYYY_MM}.pdf`);
};

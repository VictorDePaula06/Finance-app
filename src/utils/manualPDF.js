import jsPDF from 'jspdf';

export const generateManualPDF = async () => {
    const doc = new jsPDF();
    let currentY = 0;

    // --- Aesthetic Configuration ---
    const colors = {
        primary: [37, 99, 235],     // Blue 600
        secondary: [15, 23, 42],    // Slate 900
        text: [51, 65, 85],         // Slate 700
        lightText: [148, 163, 184],  // Slate 400
        border: [226, 232, 240],    // Slate 200
        accent: [16, 185, 129]       // Emerald 500
    };

    // Helper functions for layout
    const drawHeader = (title) => {
        // Dark Header Background
        doc.setFillColor(...colors.secondary);
        doc.rect(0, 0, 210, 50, 'F');

        // Brand Name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("Mêntor", 14, 22);

        // Tagline
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text("INTELIGÊNCIA FINANCEIRA E CONTROLE", 14, 30);

        // Page Title
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, 42);

        currentY = 65;
    };

    const addHeading = (text) => {
        checkPageBreak(30);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.primary);
        doc.text(text, 14, currentY);

        // Accent line under heading
        doc.setDrawColor(...colors.primary);
        doc.setLineWidth(1);
        doc.line(14, currentY + 3, 30, currentY + 3);

        currentY += 15;
    };

    const addSubHeading = (text) => {
        checkPageBreak(15);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.secondary);
        doc.text(text, 14, currentY);
        currentY += 9;
    };

    const addText = (text, isBullet = false) => {
        const margin = isBullet ? 20 : 14;
        checkPageBreak(10);

        if (isBullet) {
            // Draw a nice square bullet instead of a circle
            doc.setFillColor(...colors.primary);
            doc.rect(14, currentY - 3, 2, 2, 'F');
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.text);

        const splitText = doc.splitTextToSize(text, 180 - (isBullet ? 8 : 0));
        doc.text(splitText, margin, currentY);
        currentY += (splitText.length * 6) + 4;
    };

    const checkPageBreak = (needed) => {
        if (currentY + needed > 270) {
            doc.addPage();
            currentY = 30; // Start lower on new pages
        }
    };

    const finalizePDF = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Subtle page border or line
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.1);
            doc.line(14, 280, 196, 280);

            doc.setFontSize(9);
            doc.setTextColor(...colors.lightText);
            doc.setFont("helvetica", "normal");
            doc.text(`Mêntor - Manual Oficial v3.0`, 14, 287);
            doc.text(`Página ${i} de ${pageCount}`, 175, 287);
        }
    };

    // --- PAGE 1: INTRODUCTION ---
    drawHeader("Guia Completo de Utilização");

    addHeading("1. Introdução ao Mêntor");
    addText("O Mêntor foi projetado para ser seu braço direito na gestão financeira. Nossa plataforma utiliza inteligência artificial para transformar dados brutos em decisões inteligentes, ajudando você a atingir a liberdade financeira mais rápido.");

    addHeading("2. Dashboard e Gestão de Saldos");
    addText("O Dashboard é onde você acompanha a pulsação do seu dinheiro em tempo real.");

    addSubHeading("Diferença entre Saldos:");
    addText("Saldo em Carteira: Representa o montante total acumulado. É o dinheiro que você realmente possui hoje, considerando todo o histórico de entradas e saídas.", true);
    addText("Resultado Mensal: Foca exclusivamente no desempenho do mês atual. Indica se este mês você está 'lucrando' ou gastando mais do que ganha.", true);
    addText("Patrimônio Investido: Soma o valor base definido nas configurações com todos os aportes realizados na categoria 'Investimento'.", true);

    addSubHeading("Categorias Estratégicas:");
    addText("Saldo Inicial: Ajuste fundamental para alinhar o saldo do aplicativo com sua conta bancária real no primeiro uso.", true);
    addText("Investimento: Entradas ou saídas nesta categoria não prejudicam seu score de gastos, pois são tratadas como reserva de patrimônio.", true);
    addText("Cofre / Resgate: Utilize para separar valores específicos que não devem ser gastos no orçamento diário.", true);

    // --- PAGE 2: SCORE & PILARES ---
    checkPageBreak(120);
    addHeading("3. Saúde Financeira (Score 0-100)");
    addText("O Score Mêntor é um indicador de resiliência. Ele avalia automaticamente seu comportamento baseado em pilares recomendados por especialistas:");

    addSubHeading("Os 3 Pilares do Score:");
    addText("Performance (20%): Avalia se você manteve um balanço positivo no mês.", true);
    addText("Alocação (30%): Verifica o equilíbrio entre necessidades (50%), desejos (30%) e investimentos (20%).", true);
    addText("Reserva (50%): O ponto mais importante. Mede se seu patrimônio líquido é capaz de cobrir pelo menos 6 meses de suas despesas fixas.", true);

    addHeading("4. Metas e Objetivos");
    addText("Dê um propósito ao seu dinheiro. Ao criar uma meta, o sistema calcula o valor exato que deve ser poupado mensalmente para atingir o prazo desejado.");

    // --- PAGE 3: IA & PRIVACIDADE ---
    checkPageBreak(80);
    addHeading("5. IA Mêntor (IA Gemini)");
    addText("Integrado com a tecnologia Gemini, seu consultor financeiro está disponível 24h.");
    addText("Análise de Gastos: Peça para a IA identificar em qual categoria você mais gastou nos últimos meses.", true);
    addText("Previsões: Pergunte se uma compra específica impactará seu plano de longo prazo.", true);
    addText("Privacidade: Lembramos que seus dados são processados de forma segura e anônima para fins de consultoria.", true);

    finalizePDF();
    doc.save("Manual_Mentore_Premium.pdf");
};

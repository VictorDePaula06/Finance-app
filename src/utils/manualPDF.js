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
        doc.text("Alívia", 14, 22);

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
            doc.text(`Alívia - Manual de Tranquilidade v6.0`, 14, 287);
            doc.text(`Página ${i} de ${pageCount}`, 175, 287);
        }
    };

    // --- PAGE 1: INTRODUCTION ---
    drawHeader("Guia Completo de Utilização");

    addHeading("1. Introdução à Alívia");
    addText("A Alívia foi projetada para ser seu refúgio na gestão financeira. Nossa plataforma utiliza inteligência artificial para transformar a ansiedade dos números em caminhos de paz, ajudando você a atingir a tranquilidade financeira com leveza.");

    addHeading("2. Dashboard e Gestão de Saldos");
    addText("O Dashboard é onde você acompanha a pulsação do seu dinheiro em tempo real.");

    addSubHeading("Diferença entre Saldos:");
    addText("Saldo em Carteira: Representa o montante total acumulado. É o dinheiro que você realmente possui hoje, considerando todo o histórico de entradas e saídas.", true);
    addText("Resultado Mensal: Foca exclusivamente no desempenho do mês atual. Indica se este mês você está 'lucrando' ou gastando mais do que ganha.", true);
    addText("Sementinha / Futuro: Soma o valor base definido por você com todos os aportes realizados para proteger o seu amanhã.", true);

    addSubHeading("Categorias Estratégicas:");
    addText("Saldo Inicial: Ajuste fundamental para alinhar o saldo do aplicativo com sua conta bancária real no primeiro uso.", true);
    addText("Sementinha / Futuro: Guardar valores aqui não prejudica seu score de tranquilidade, pois são tratados como proteção de patrimônio.", true);
    addText("Cofre / Resgate: Utilize para separar valores específicos que não devem ser usados no dia a dia.", true);

    addSubHeading("Margem de Segurança (Controle de Ritmo):");
    addText("A Margem de Segurança é o seu teto de gastos individual por categoria. Ao definir um valor (ex: R$ 500 para Alimentação), a Alívia monitora a velocidade dos seus gastos diariamente. Se você gastar metade desse valor nos primeiros dias do mês, ela emitirá um 'Alerta de Tranquilidade' para te ajudar a recalcular a rota antes que o dinheiro acabe.");

    // --- PAGE 2: SCORE & PILARES ---
    checkPageBreak(120);
    addHeading("3. Saúde Financeira (Score 0-100)");
    addText("O Nível de Tranquilidade da Alívia é um indicador de paz. Ele avalia automaticamente seu comportamento baseado em pilares de saúde financeira:");

    addSubHeading("Os 3 Pilares do Score:");
    addText("Performance (20%): Avalia se você manteve um balanço positivo no mês.", true);
    addText("Alocação (30%): Verifica o equilíbrio entre o hoje (50% necessário, 30% lazer) e o amanhã (20% sementinhas).", true);
    addText("Reserva (50%): O ponto mais importante. Mede se seu patrimônio líquido é capaz de cobrir pelo menos 6 meses de suas despesas fixas.", true);

    addHeading("4. Metas e Objetivos");
    addText("Dê um propósito ao seu dinheiro. Ao criar uma meta, o sistema calcula o valor exato que deve ser poupado mensalmente para atingir o prazo desejado.");

    // --- PAGE 3: IA & PRIVACIDADE ---
    checkPageBreak(80);
    addHeading("5. Sua Alívia (IA Gemini)");
    addText("Integrado com a tecnologia Gemini, seu consultor financeiro está disponível 24h.");
    addText("Análise de Gastos: Peça para a IA identificar em qual categoria você mais gastou nos últimos meses.", true);
    addText("Previsões: Pergunte se uma compra específica impactará seu plano de longo prazo.", true);
    addText("Privacidade: Lembramos que seus dados são processados de forma segura e anônima para fins de consultoria.", true);

    finalizePDF();
    doc.save("Manual_Alivia_Premium.pdf");
};

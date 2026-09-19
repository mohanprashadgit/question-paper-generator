/**
 * PDF Generator
 * Professional A4 PDF export using jsPDF with autoTable and html2pdf fallback
 * Grace College Question Paper Generator
 */
const PDFGenerator = {
    /**
     * Main entry point to generate and download PDF
     */
    async generatePDF(paperDataOverride = null) {
        if (!paperDataOverride && typeof App !== 'undefined') {
            App.syncFieldsToState();
            App.ensureRegulationStructure();
        }

        const paperData = paperDataOverride || (typeof App !== 'undefined' ? App.getCurrentPaperData() : {});
        const regulation = paperData.regulation || '21';
        const template = regulation === '25' ? REGULATION_25 : REGULATION_21;
        const questions = (paperData.questions && paperData.questions.length > 0)
            ? paperData.questions
            : (typeof App !== 'undefined' ? App.state.questions : []);
        const analysis = (typeof Analysis !== 'undefined' && Analysis.compute)
            ? Analysis.compute(questions)
            : { competency: { data: {}, totalMarks: 0 }, coAnalysis: { data: {}, totalMarks: 0 } };

        // Sanitize filename to prevent invalid OS path/download errors
        const safeCourse = (paperData.course_code || 'QP').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeExam = (paperData.exam_type || 'Paper').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeReg = (paperData.regulation || '21').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeCourse}_${safeExam}_${safeReg}Reg.pdf`.replace(/_+/g, '_');

        if (typeof App !== 'undefined') {
            App.showToast(`Generating PDF: ${filename}...`, 'info');
        }

        // Method 1: Try jsPDF + autoTable vector generation
        try {
            const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            if (jsPDFClass) {
                const success = await this.generateWithJsPDF(paperData, template, questions, analysis, filename, jsPDFClass);
                if (success) {
                    this.onSuccess(paperData, filename, paperDataOverride);
                    return;
                }
            }
        } catch (err) {
            console.warn('Vector jsPDF generation failed, falling back to html2pdf:', err);
        }

        // Method 2: Fallback to html2pdf.js
        try {
            if (typeof html2pdf === 'function' && typeof Preview !== 'undefined') {
                const success = await this.generateWithHtml2Pdf(paperData, filename);
                if (success) {
                    this.onSuccess(paperData, filename, paperDataOverride);
                    return;
                }
            }
        } catch (err2) {
            console.warn('html2pdf fallback failed, falling back to print view:', err2);
        }

        // Method 3: Fallback to high-res browser print / Save as PDF
        if (typeof App !== 'undefined') {
            App.showToast('Opening PDF Print view (Choose "Save as PDF")...', 'info');
        }
        if (typeof Preview !== 'undefined') {
            Preview.print(paperData);
            this.onSuccess(paperData, filename, paperDataOverride);
        }
    },

    /**
     * Vector jsPDF + autoTable generator
     */
    async generateWithJsPDF(paperData, template, questions, analysis, filename, jsPDFClass) {
        const doc = new jsPDFClass({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Ensure autoTable is bound
        if (typeof doc.autoTable !== 'function' && typeof window.jspdf?.jsPDF?.API?.autoTable === 'function') {
            doc.autoTable = window.jspdf.jsPDF.API.autoTable;
        }

        if (typeof doc.autoTable !== 'function') {
            console.warn('doc.autoTable is not available');
            return false;
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const m = template.pdfLayout?.margins || { top: 8, right: 10, bottom: 8, left: 10 };
        const contentWidth = pageWidth - m.left - m.right;
        let y = m.top;

        // === 1. REG NO BOXES (top-right corner, above logo) ===
        if (template.pdfLayout?.showRegNoBoxes) {
            doc.setFont('times', 'bold');
            doc.setFontSize(9);
            const regText = 'Reg. No. :';
            const regTextWidth = doc.getTextWidth(regText);
            const boxSize = 4.5;
            const boxCount = template.pdfLayout.regNoBoxCount || 12;
            const totalBoxWidth = boxCount * (boxSize + 1);
            const regX = pageWidth - m.right - totalBoxWidth;

            doc.text(regText, regX - regTextWidth - 2, y + 3.2);
            for (let i = 0; i < boxCount; i++) {
                doc.rect(regX + i * (boxSize + 1), y, boxSize, boxSize);
            }
            y += boxSize + 3;
        }

        // === 2. LOGO ===
        try {
            const logoResult = await this.loadImage('logo.png');
            if (logoResult && (logoResult.dataUrl || logoResult.img)) {
                const logoWidth = contentWidth * 0.82;
                const aspect = (logoResult.height && logoResult.width) ? (logoResult.height / logoResult.width) : (348 / 1386);
                const logoHeight = logoWidth * aspect;
                const logoX = (pageWidth - logoWidth) / 2;
                const imgSource = logoResult.dataUrl || logoResult.img;
                doc.addImage(imgSource, 'PNG', logoX, y, logoWidth, logoHeight);
                y += logoHeight + 2;
            } else {
                throw new Error('Logo not available');
            }
        } catch (e) {
            doc.setFont('times', 'bold');
            doc.setFontSize(13);
            doc.text('GRACE COLLEGE OF ENGINEERING', pageWidth / 2, y + 4, { align: 'center' });
            doc.setFontSize(8);
            doc.setFont('times', 'normal');
            doc.text('(Approved by AICTE, New Delhi & Affiliated to ANNA UNIVERSITY, Chennai)', pageWidth / 2, y + 8, { align: 'center' });
            doc.text('Mullakkadu, THOOTHUKUDI – 05', pageWidth / 2, y + 12, { align: 'center' });
            y += 15;
        }

        // === 3. REGULATION BELOW LOGO ===
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        const rawReg = paperData.regulation || '21';
        const regYear = rawReg.length === 2 ? '20' + rawReg : rawReg;
        const regText = `(Regulations ${regYear})`;
        doc.text(regText, pageWidth / 2, y, { align: 'center' });
        y += 4.5;

        // === 4. EXAM TITLE ===
        doc.setFontSize(11);
        doc.setFont('times', 'bold');
        const examTitle = paperData.exam_type || 'Internal Assessment-I';
        doc.text(examTitle, pageWidth / 2, y, { align: 'center' });
        const titleWidth = doc.getTextWidth(examTitle);
        doc.line((pageWidth - titleWidth) / 2, y + 0.6, (pageWidth + titleWidth) / 2, y + 0.6);
        y += 5;

        // === 5. PAPER INFO ===
        doc.setFontSize(9);
        const leftCol = m.left;
        const rightCol = pageWidth / 2 + 5;

        const dateStr = paperData.exam_date ? new Date(paperData.exam_date).toLocaleDateString('en-IN') : '';
        const degree = paperData.degree || (paperData.programme === 'Artificial Intelligence and Data Science' ? 'B.Tech' : 'B.E.');
        const yearSemStr = (paperData.year || paperData.semester)
            ? `${paperData.year || ''}${paperData.year && paperData.semester ? ' / ' : ''}${paperData.semester || ''}`
            : '';

        const infoLines = [
            { left: `Programme : ${degree} – ${paperData.programme || ''}`, right: `Date : ${dateStr}` },
            { left: `Course Code & Name : ${paperData.course_code || ''} – ${paperData.course_name || ''}`, right: `Duration : ${paperData.duration || '1 1/2 hrs'}` },
            { left: `Year / Sem : ${yearSemStr}`, right: `Max. Marks : ${template.totalMarks || 50}` }
        ];

        infoLines.forEach(line => {
            doc.setFont('times', 'normal');
            doc.text(line.left, leftCol, y);
            doc.text(line.right, rightCol, y);
            y += 4;
        });

        y += 0.5;
        doc.line(m.left, y, pageWidth - m.right, y);
        y += 3;

        // === 6. SECTIONS & QUESTIONS ===
        template.sections.forEach(section => {
            const sectionQs = questions.filter(q => q.part === section.part && !q.parent_id);

            // Check page space
            if (y > pageHeight - 45) {
                doc.addPage();
                y = m.top;
            }

            // Section title
            doc.setFont('times', 'bold');
            doc.setFontSize(10.5);
            doc.text(section.title, pageWidth / 2, y, { align: 'center' });
            const stWidth = doc.getTextWidth(section.title);
            doc.line((pageWidth - stWidth) / 2, y + 0.5, (pageWidth + stWidth) / 2, y + 0.5);
            y += 3.5;

            doc.setFontSize(9);
            doc.text(section.subtitle, pageWidth / 2, y, { align: 'center' });
            y += 2.5;

            doc.setFont('times', 'normal');
            doc.setFontSize(8);
            doc.text(section.description, pageWidth / 2, y, { align: 'center' });
            y += 3;

            // Build table data
            const tableBody = [];
            sectionQs.forEach(q => {
                const hasOR = q.children && q.children.some(c => c.or_group);
                const hasSub = q.children && q.children.some(c => c.sub_number);

                if (hasOR) {
                    const orA = q.children.find(c => c.or_group === 'a');
                    const orB = q.children.find(c => c.or_group === 'b');

                    if (orA) {
                        tableBody.push([
                            `${q.question_number} (a)`,
                            this.stripHTML(orA.question_text),
                            `${orA.co || 'CO1'}-${orA.k_level || 'K1'}`,
                            String(orA.marks || q.marks || '')
                        ]);
                    }
                    tableBody.push([{ content: '(OR)', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } }]);
                    if (orB) {
                        tableBody.push([
                            `${q.question_number} (b)`,
                            this.stripHTML(orB.question_text),
                            `${orB.co || 'CO1'}-${orB.k_level || 'K1'}`,
                            String(orB.marks || q.marks || '')
                        ]);
                    }
                } else if (hasSub) {
                    const subs = q.children.filter(c => c.sub_number);
                    tableBody.push([
                        String(q.question_number),
                        this.stripHTML(q.question_text),
                        `${q.co || 'CO1'}-${q.k_level || 'K1'}`,
                        String(q.marks || '')
                    ]);
                    subs.forEach(sub => {
                        tableBody.push([
                            '',
                            `(${sub.sub_number}) ${this.stripHTML(sub.question_text)}`,
                            `${sub.co || 'CO1'}-${sub.k_level || 'K1'}`,
                            String(sub.marks || '')
                        ]);
                    });
                } else {
                    let text = this.stripHTML(q.question_text);
                    // MCQ options formatting
                    if (q.question_type === 'mcq' && q.mcq_options && Array.isArray(q.mcq_options)) {
                        text += '\n' + q.mcq_options.map(opt => `(${opt.label}) ${opt.text || '___'}`).join('    ');
                    }
                    tableBody.push([
                        String(q.question_number),
                        text,
                        `${q.co || 'CO1'}-${q.k_level || 'K1'}`,
                        String(q.marks || '')
                    ]);
                }
            });

            if (tableBody.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: [['Q. No', 'Question', 'CO-K Level', 'Max. Marks']],
                    body: tableBody,
                    theme: 'grid',
                    styles: {
                        font: 'times',
                        fontSize: 9,
                        cellPadding: 2,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.2,
                        textColor: [0, 0, 0]
                    },
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'center'
                    },
                    columnStyles: {
                        0: { cellWidth: 16, halign: 'center' },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 22, halign: 'center' },
                        3: { cellWidth: 20, halign: 'center' }
                    },
                    margin: { left: m.left, right: m.right }
                });

                y = (doc.lastAutoTable?.finalY || y + 20) + 4;
            }
        });

        // === 7. COMPETENCY ANALYSIS ===
        if (analysis?.competency?.data) {
            if (y > pageHeight - 65) {
                doc.addPage();
                y = m.top;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(10);
            doc.text('Competency Level Analysis', pageWidth / 2, y, { align: 'center' });
            const claWidth = doc.getTextWidth('Competency Level Analysis');
            doc.line((pageWidth - claWidth) / 2, y + 0.5, (pageWidth + claWidth) / 2, y + 0.5);
            y += 4;

            const compBody = [];
            Object.values(analysis.competency.data).forEach(entry => {
                if (entry.marks > 0) {
                    compBody.push([entry.level, entry.taxonomy, (entry.questions || []).join(', '), String(entry.marks), entry.percentage + '%']);
                }
            });
            compBody.push([{ content: 'Total', colSpan: 3, styles: { fontStyle: 'bold' } }, String(analysis.competency.totalMarks || 0), '100%']);

            doc.autoTable({
                startY: y,
                head: [['Level', "Bloom's Taxonomy", 'Question No.', 'Marks', 'Contribution %']],
                body: compBody,
                theme: 'grid',
                styles: { font: 'times', fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto', halign: 'center' }, 3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 26, halign: 'center' } },
                margin: { left: m.left, right: m.right }
            });
            y = (doc.lastAutoTable?.finalY || y + 20) + 5;
        }

        // === 8. CO ANALYSIS ===
        if (analysis?.coAnalysis?.data) {
            if (y > pageHeight - 50) {
                doc.addPage();
                y = m.top;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(10);
            doc.text('Course Outcome Marks Contribution', pageWidth / 2, y, { align: 'center' });
            const coaWidth = doc.getTextWidth('Course Outcome Marks Contribution');
            doc.line((pageWidth - coaWidth) / 2, y + 0.5, (pageWidth + coaWidth) / 2, y + 0.5);
            y += 4;

            const coBody = [];
            Object.values(analysis.coAnalysis.data).forEach(entry => {
                coBody.push([entry.co, String(entry.marks), entry.percentage + '%']);
            });
            coBody.push([{ content: 'Total', styles: { fontStyle: 'bold' } }, String(analysis.coAnalysis.totalMarks || 0), '100%']);

            doc.autoTable({
                startY: y,
                head: [['Course Outcome', 'Marks', 'Contribution %']],
                body: coBody,
                theme: 'grid',
                styles: { font: 'times', fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { cellWidth: 40, halign: 'center' }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' } },
                margin: { left: m.left, right: m.right }
            });
            y = (doc.lastAutoTable?.finalY || y + 20) + 8;
        }

        // === 9. FOOTER SIGNATURES ===
        if (y > pageHeight - 28) {
            doc.addPage();
            y = pageHeight - 24;
        } else {
            y = Math.max(y, pageHeight - 24);
        }

        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        const footerCols = template.pdfLayout?.footer?.columns || [
            { label: 'Prepared By' },
            { label: 'Course Coordinator' },
            { label: 'Verified By IQAC' },
            { label: 'Approved By HoD' }
        ];
        const colWidth = contentWidth / footerCols.length;

        footerCols.forEach((col, i) => {
            const x = m.left + (i * colWidth) + colWidth / 2;
            doc.line(x - 18, y, x + 18, y);
            doc.text(col.label, x, y + 4, { align: 'center' });
        });

        // === 10. SAVE PDF FILE ===
        try {
            doc.save(filename);
            return true;
        } catch (saveErr) {
            console.warn('doc.save() failed, attempting blob anchor fallback:', saveErr);
            const blob = doc.output('blob');
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            return true;
        }
    },

    /**
     * html2pdf fallback generator
     */
    async generateWithHtml2Pdf(paperData, filename) {
        const html = Preview.getPaperHTML(paperData);
        const tempDiv = document.createElement('div');
        tempDiv.className = 'a4-page';
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = '210mm';
        tempDiv.style.background = '#ffffff';
        tempDiv.style.color = '#000000';
        tempDiv.style.boxSizing = 'border-box';
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);

        const opt = {
            margin: [8, 10, 8, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(tempDiv).save();
            document.body.removeChild(tempDiv);
            return true;
        } catch (e) {
            if (tempDiv.parentNode) document.body.removeChild(tempDiv);
            throw e;
        }
    },

    /**
     * Called on successful PDF download
     */
    onSuccess(paperData, filename, paperDataOverride) {
        if (paperData && paperData.id) {
            paperData.status = 'exported';
            if (!paperDataOverride && typeof App !== 'undefined') {
                App.state.status = 'exported';
                App.savePaper();
            } else if (typeof Storage !== 'undefined') {
                Storage.savePaper(paperData);
                Storage.filterPapers();
            }
        }
        if (typeof App !== 'undefined') {
            App.showToast(`PDF downloaded: ${filename}`, 'success');
        }
    },

    /**
     * Safely strip HTML tags for plain text tables
     */
    stripHTML(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const text = temp.textContent || temp.innerText || '';
        return text.trim();
    },

    /**
     * Safely load an image with timeout and CORS safety
     */
    loadImage(src) {
        return new Promise((resolve) => {
            if (!src) return resolve(null);
            const img = new Image();
            if (src.startsWith('http://') || src.startsWith('https://')) {
                img.crossOrigin = 'anonymous';
            }
            const timer = setTimeout(() => {
                resolve(null);
            }, 2500);

            img.onload = () => {
                clearTimeout(timer);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve({ dataUrl, width: canvas.width, height: canvas.height, img });
                } catch (e) {
                    resolve({ dataUrl: null, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, img });
                }
            };

            img.onerror = () => {
                clearTimeout(timer);
                resolve(null);
            };

            img.src = src;
        });
    }
};

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
            // Auto-save paper before PDF export
            App.savePaper();
        }

        const paperData = paperDataOverride || (typeof App !== 'undefined' ? App.getCurrentPaperData() : {});
        const regulation = paperData.regulation || '21';
        const template = (typeof App !== 'undefined' && App.getTemplate) ? App.getTemplate(regulation) : (regulation === '25' ? REGULATION_25 : REGULATION_21);
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
        const m = template.pdfLayout?.margins || { top: 10, right: 12, bottom: 10, left: 12 };
        const contentWidth = pageWidth - m.left - m.right;
        let y = m.top;

        // === 1. REG NO BOXES (top-right corner, above logo) ===
        if (template.pdfLayout?.showRegNoBoxes) {
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            const regText = 'Reg. No. :';
            const regTextWidth = doc.getTextWidth(regText);
            const boxSize = 5.5;
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
        doc.setFontSize(12);
        const rawReg = paperData.regulation || '21';
        const regYear = rawReg.length === 2 ? '20' + rawReg : rawReg;
        const regText = `(Regulations ${regYear})`;
        doc.text(regText, pageWidth / 2, y, { align: 'center' });
        y += 5.5;

        // === 4. EXAM TITLE ===
        doc.setFontSize(13);
        doc.setFont('times', 'bold');
        const examTitle = paperData.exam_type || 'Internal Assessment-I';
        doc.text(examTitle, pageWidth / 2, y, { align: 'center' });
        const titleWidth = doc.getTextWidth(examTitle);
        doc.line((pageWidth - titleWidth) / 2, y + 0.6, (pageWidth + titleWidth) / 2, y + 0.6);
        y += 6;

        // === 5. PAPER INFO ===
        doc.setFontSize(11);
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
            y += 5.5;
        });

        y += 1;
        doc.line(m.left, y, pageWidth - m.right, y);
        y += 4;

        // === PRELOAD QUESTION IMAGES ===
        const imageCache = new Map();
        const preloadPromises = [];
        const collectImages = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach(item => {
                if (item.image_path && typeof item.image_path === 'string' && item.image_path.trim()) {
                    preloadPromises.push((async () => {
                        try {
                            const loaded = await this.loadImage(item.image_path);
                            if (loaded) imageCache.set(item.image_path, loaded);
                        } catch (err) {
                            console.warn('Image preload failed:', err);
                        }
                    })());
                }
                if (item.children && Array.isArray(item.children)) {
                    collectImages(item.children);
                }
            });
        };
        collectImages(questions);
        await Promise.all(preloadPromises);

        // Count total images for adaptive sizing within 2-page limit
        const totalImageCount = imageCache.size;

        // Helper to wrap question cell with image and appropriate minCellHeight
        const makeQuestionCell = (text, qItem) => {
            const imgData = (qItem && qItem.image_path) ? imageCache.get(qItem.image_path) : null;
            if (!imgData) {
                return text;
            }

            const naturalWidth = imgData.width || 300;
            const naturalHeight = imgData.height || 200;
            const aspect = naturalHeight / naturalWidth;
            const maxColWidth = Math.max(60, contentWidth - 70);

            // Scale down images when many are present to stay within 2-page limit
            const imgScale = totalImageCount > 5 ? 0.45 : totalImageCount > 3 ? 0.65 : 1.0;

            let targetWidthMm;
            if (qItem.image_size === 'custom' && qItem.image_width) {
                targetWidthMm = Math.min(parseFloat(qItem.image_width) * 0.264583 * imgScale, maxColWidth);
            } else if (qItem.image_size === 'small') {
                targetWidthMm = Math.min(35 * imgScale, maxColWidth);
            } else if (qItem.image_size === 'large') {
                targetWidthMm = Math.min(95 * imgScale, maxColWidth);
            } else {
                targetWidthMm = Math.min(60 * imgScale, maxColWidth);
            }

            let targetHeightMm = targetWidthMm * aspect;
            const maxImgHeight = 85 * imgScale;
            if (targetHeightMm > maxImgHeight) {
                targetHeightMm = maxImgHeight;
                targetWidthMm = targetHeightMm / aspect;
            }

            doc.setFont('times', 'normal');
            doc.setFontSize(11);
            const splitLines = doc.splitTextToSize(text || '', maxColWidth);
            const lineCount = Array.isArray(splitLines) ? Math.max(1, splitLines.length) : 1;
            const textHeightMm = lineCount * 4.8;
            const minHeightMm = textHeightMm + targetHeightMm + 9;

            return {
                content: text,
                _imageInfo: {
                    dataUrl: imgData.dataUrl || imgData.img,
                    format: imgData.format || 'PNG',
                    width: targetWidthMm,
                    height: targetHeightMm,
                    align: qItem.image_alignment || 'center'
                },
                styles: {
                    minCellHeight: minHeightMm
                }
            };
        };

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
            doc.setFontSize(13);
            doc.text(section.title, pageWidth / 2, y, { align: 'center' });
            const stWidth = doc.getTextWidth(section.title);
            doc.line((pageWidth - stWidth) / 2, y + 0.5, (pageWidth + stWidth) / 2, y + 0.5);
            y += 5;

            doc.setFontSize(11);
            doc.text(section.subtitle, pageWidth / 2, y, { align: 'center' });
            y += 4;

            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            doc.text(section.description, pageWidth / 2, y, { align: 'center' });
            y += 4;

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
                            makeQuestionCell(this.stripHTML(orA.question_text), orA),
                            `${orA.co || 'CO1'}-${orA.k_level || 'K1'}`,
                            String(orA.marks || q.marks || '')
                        ]);
                    }
                    tableBody.push([{ content: '(OR)', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fontSize: 11 } }]);
                    if (orB) {
                        tableBody.push([
                            `${q.question_number} (b)`,
                            makeQuestionCell(this.stripHTML(orB.question_text), orB),
                            `${orB.co || 'CO1'}-${orB.k_level || 'K1'}`,
                            String(orB.marks || q.marks || '')
                        ]);
                    }
                } else if (hasSub) {
                    const subs = q.children.filter(c => c.sub_number);
                    tableBody.push([
                        String(q.question_number),
                        makeQuestionCell(this.stripHTML(q.question_text), q),
                        `${q.co || 'CO1'}-${q.k_level || 'K1'}`,
                        String(q.marks || '')
                    ]);
                    subs.forEach(sub => {
                        tableBody.push([
                            '',
                            makeQuestionCell(`(${sub.sub_number}) ${this.stripHTML(sub.question_text)}`, sub),
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
                        makeQuestionCell(text, q),
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
                    rowPageBreak: 'avoid',
                    styles: {
                        font: 'times',
                        fontSize: 11,
                        cellPadding: 2,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.25,
                        textColor: [0, 0, 0],
                        minCellHeight: 6
                    },
                    headStyles: {
                        fillColor: [230, 230, 230],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'center',
                        fontSize: 11
                    },
                    columnStyles: {
                        0: { cellWidth: 18, halign: 'center' },
                        1: { cellWidth: 'auto' },
                        2: { cellWidth: 24, halign: 'center' },
                        3: { cellWidth: 22, halign: 'center' }
                    },
                    margin: { left: m.left, right: m.right },
                    didDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index === 1) {
                            const raw = data.cell.raw;
                            const imageInfo = raw && raw._imageInfo;
                            if (imageInfo && imageInfo.dataUrl) {
                                const cell = data.cell;
                                const pLeft = typeof cell.padding === 'function' ? cell.padding('left') : (cell.padding?.left || 3);
                                const pRight = typeof cell.padding === 'function' ? cell.padding('right') : (cell.padding?.right || 3);
                                const pTop = typeof cell.padding === 'function' ? cell.padding('top') : (cell.padding?.top || 3);
                                const pBottom = typeof cell.padding === 'function' ? cell.padding('bottom') : (cell.padding?.bottom || 3);

                                const availWidth = cell.width - pLeft - pRight;
                                let imgX = cell.x + pLeft;
                                if (imageInfo.align === 'center') {
                                    imgX = cell.x + pLeft + Math.max(0, (availWidth - imageInfo.width) / 2);
                                } else if (imageInfo.align === 'right') {
                                    imgX = cell.x + cell.width - pRight - imageInfo.width;
                                }

                                const textLines = Array.isArray(cell.text) ? cell.text.length : 1;
                                const fontSize = (cell.styles && cell.styles.fontSize) || 11;
                                const lineH = fontSize * (25.4 / 72) * 1.25;
                                const textHeight = textLines * lineH;
                                let imgY = cell.y + pTop + textHeight + 2;

                                const maxImgY = cell.y + cell.height - imageInfo.height - pBottom;
                                if (imgY > maxImgY) imgY = maxImgY;
                                if (imgY < cell.y + pTop) imgY = cell.y + pTop;

                                try {
                                    doc.addImage(
                                        imageInfo.dataUrl,
                                        imageInfo.format || 'PNG',
                                        imgX,
                                        imgY,
                                        imageInfo.width,
                                        imageInfo.height
                                    );
                                } catch (imgErr) {
                                    console.warn('Failed to embed question image into PDF cell:', imgErr);
                                }
                            }
                        }
                    }
                });

                y = (doc.lastAutoTable?.finalY || y + 20) + 3;
            }
        });

        // === 7. COMPETENCY ANALYSIS ===
        if (analysis?.competency?.data) {
            if (y > pageHeight - 40 && doc.internal.getNumberOfPages() < 2) {
                doc.addPage();
                y = m.top;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(10);
            doc.text('Competency Level Analysis', pageWidth / 2, y, { align: 'center' });
            const claWidth = doc.getTextWidth('Competency Level Analysis');
            doc.line((pageWidth - claWidth) / 2, y + 0.5, (pageWidth + claWidth) / 2, y + 0.5);
            y += 3;

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
                styles: { font: 'times', fontSize: 9, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [0, 0, 0], minCellHeight: 5 },
                headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 9 },
                columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto', halign: 'center' }, 3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 24, halign: 'center' } },
                margin: { left: m.left, right: m.right }
            });
            y = (doc.lastAutoTable?.finalY || y + 20) + 3;
        }

        // === 8. CO ANALYSIS ===
        if (analysis?.coAnalysis?.data) {
            if (y > pageHeight - 30 && doc.internal.getNumberOfPages() < 2) {
                doc.addPage();
                y = m.top;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(10);
            doc.text('Course Outcome Marks Contribution', pageWidth / 2, y, { align: 'center' });
            const coaWidth = doc.getTextWidth('Course Outcome Marks Contribution');
            doc.line((pageWidth - coaWidth) / 2, y + 0.5, (pageWidth + coaWidth) / 2, y + 0.5);
            y += 3;

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
                styles: { font: 'times', fontSize: 9, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.25, textColor: [0, 0, 0], minCellHeight: 5 },
                headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 9 },
                columnStyles: { 0: { cellWidth: 35, halign: 'center' }, 1: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 35, halign: 'center' } },
                margin: { left: m.left, right: m.right }
            });
            y = (doc.lastAutoTable?.finalY || y + 20) + 3;
        }

        // === 9. FOOTER SIGNATURES (with strict 2-page enforcement) ===
        // Enforce strict 2-page limit: delete any excess pages
        let currentTotalPages = doc.internal.getNumberOfPages();
        if (currentTotalPages > 2) {
            for (let p = currentTotalPages; p > 2; p--) {
                doc.deletePage(p);
            }
            doc.setPage(2);
        }
        // Position footer at bottom of last page (max page 2)
        y = doc.internal.pageSize.getHeight() - 24;

        doc.setFont('times', 'normal');
        doc.setFontSize(10);
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

        // Ensure all images are fully loaded before capturing
        const imgs = Array.from(tempDiv.querySelectorAll('img'));
        if (imgs.length > 0) {
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(res => {
                    img.onload = res;
                    img.onerror = res;
                    setTimeout(res, 2500);
                });
            }));
        }

        const opt = {
            margin: [10, 12, 10, 12],
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
            if (!src || typeof src !== 'string' || !src.trim()) return resolve(null);
            const img = new Image();
            if (src.startsWith('http://') || src.startsWith('https://')) {
                img.crossOrigin = 'anonymous';
            }
            const timer = setTimeout(() => {
                resolve(null);
            }, 3000);

            img.onload = () => {
                clearTimeout(timer);
                try {
                    const naturalWidth = img.naturalWidth || img.width || 300;
                    const naturalHeight = img.naturalHeight || img.height || 200;

                    // If it's already a standard PNG/JPEG data URL, use it directly
                    if (src.startsWith('data:image/png')) {
                        return resolve({ dataUrl: src, width: naturalWidth, height: naturalHeight, format: 'PNG', img });
                    }
                    if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) {
                        return resolve({ dataUrl: src, width: naturalWidth, height: naturalHeight, format: 'JPEG', img });
                    }

                    // Otherwise convert to standard PNG data URL via canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = naturalWidth;
                    canvas.height = naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve({ dataUrl, width: naturalWidth, height: naturalHeight, format: 'PNG', img });
                } catch (e) {
                    resolve({ dataUrl: src, width: img.naturalWidth || img.width || 300, height: img.naturalHeight || img.height || 200, format: 'PNG', img });
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

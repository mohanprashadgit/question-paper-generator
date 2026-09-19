/**
 * Preview Module
 * Live A4 preview matching Grace College PDF format
 * Grace College Question Paper Generator
 */
const Preview = {
    /**
     * Generate HTML for a complete question paper
     */
    getPaperHTML(paperData) {
        const regulation = paperData.regulation || '21';
        const template = regulation === '25' ? REGULATION_25 : REGULATION_21;
        const questions = paperData.questions || [];
        const analysis = Analysis.compute(questions);

        let html = '';
        // === College Logo with Reg No at top-right ===
        html += this.renderHeader(paperData, template);

        // === Paper Info ===
        html += this.renderPaperInfo(paperData, template);

        // === Sections ===
        template.sections.forEach(section => {
            html += this.renderSection(section, questions, template);
        });

        // === Analysis Tables ===
        html += this.renderCompetencyAnalysis(analysis.competency);
        html += this.renderCOAnalysis(analysis.coAnalysis);

        // === Footer ===
        html += this.renderFooter(template);

        return html;
    },

    /**
     * Render the live A4 preview
     */
    render(paperData) {
        const container = document.getElementById('a4Preview');
        if (!container) return;
        container.innerHTML = this.getPaperHTML(paperData);
    },

    /**
     * Prepare print area and print one or multiple papers
     */
    print(papers) {
        let printArea = document.getElementById('printArea');
        if (!printArea) {
            printArea = document.createElement('div');
            printArea.id = 'printArea';
            document.body.appendChild(printArea);
        }

        const paperList = Array.isArray(papers) ? papers : [papers];
        if (paperList.length === 0) return;

        let html = '';
        paperList.forEach((paper, index) => {
            const isLast = index === paperList.length - 1;
            html += `<div class="a4-page ${!isLast ? 'bulk-print-page' : ''}">`;
            html += this.getPaperHTML(paper);
            html += `</div>`;
        });

        printArea.innerHTML = html;

        // Small delay to ensure browser renders images/DOM before print dialog
        setTimeout(() => {
            window.print();
        }, 150);
    },

    renderHeader(paperData, template) {
        // Reg No boxes positioned at top-right corner of the page
        let regNoHtml = '';
        if (template.pdfLayout.showRegNoBoxes) {
            let boxes = '';
            for (let i = 0; i < template.pdfLayout.regNoBoxCount; i++) {
                boxes += '<span class="reg-no-box"></span>';
            }
            regNoHtml = `<div class="reg-no-row">
                <span>Reg. No. :</span> ${boxes}
            </div>`;
        }

        const regYear = paperData.regulation ? (paperData.regulation.length === 2 ? '20' + paperData.regulation : paperData.regulation) : '2021';
        const regText = `(Regulations ${regYear})`;

        return `
            <div class="college-header">
                ${regNoHtml}
                <img class="college-logo" src="logo.png" alt="Grace College of Engineering" onerror="this.style.display='none'">
                <div class="header-regulation">${regText}</div>
            </div>
            <div class="exam-title">${paperData.exam_type || 'Internal Assessment-I'}</div>`;
    },

    renderPaperInfo(paperData, template) {
        const dateStr = paperData.exam_date ? new Date(paperData.exam_date).toLocaleDateString('en-IN') : '';
        const degree = paperData.degree || (paperData.programme === 'Artificial Intelligence and Data Science' ? 'B.Tech' : 'B.E.');
        return `
            <div class="paper-info">
                <div class="info-row"><span class="info-label">Programme :</span> ${degree} – ${paperData.programme || ''}</div>
                <div class="info-row"><span class="info-label">Date :</span> ${dateStr}</div>
                <div class="info-row"><span class="info-label">Course Code & Name :</span> ${paperData.course_code || ''} – ${paperData.course_name || ''}</div>
                <div class="info-row"><span class="info-label">Duration :</span> ${paperData.duration || '1 1/2 hrs'}</div>
                <div class="info-row"><span class="info-label">Year / Sem :</span> ${paperData.year || ''}${paperData.year && paperData.semester ? ' / ' : ''}${paperData.semester || ''}</div>
                <div class="info-row"><span class="info-label">Max. Marks :</span> ${template.totalMarks}</div>
            </div>`;
    },

    renderSection(section, questions, template) {
        const sectionQs = questions.filter(q => q.part === section.part && !q.parent_id);

        let html = `
            <div class="part-title">${section.title}</div>
            <div class="part-subtitle">${section.subtitle}</div>
            <div class="part-subtitle" style="font-weight:normal; font-size:8pt; margin-bottom:1.5mm;">${section.description}</div>
            <table class="question-table">
                <thead>
                    <tr>
                        ${template.tableColumns.map(col => `<th class="col-${col === 'Q. No' ? 'qno' : col === 'Question' ? 'question' : col === 'CO-K Level' ? 'cok' : 'marks'}">${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>`;

        sectionQs.forEach(q => {
            const hasOR = q.children && q.children.some(c => c.or_group);
            const hasSub = q.children && q.children.some(c => c.sub_number);

            if (hasOR) {
                const orA = q.children.find(c => c.or_group === 'a');
                const orB = q.children.find(c => c.or_group === 'b');

                if (orA) {
                    html += this.renderQuestionRow(q.question_number, ' (a)', orA, true);
                }
                html += `<tr class="or-row"><td colspan="4" style="text-align:center; font-weight:bold; border-left:1px solid #000; border-right:1px solid #000; padding:2px;">(OR)</td></tr>`;
                if (orB) {
                    html += this.renderQuestionRow(q.question_number, ' (b)', orB, true);
                }
            } else if (hasSub) {
                const subs = q.children.filter(c => c.sub_number);
                html += `<tr>
                    <td class="col-qno" rowspan="${subs.length + 1}">${q.question_number}</td>
                    <td class="col-question">${this.cleanHTML(q.question_text)}${q.image_path ? this.renderImageInTable(q) : ''}</td>
                    <td class="col-cok">${q.co}-${q.k_level}</td>
                    <td class="col-marks">${q.marks}</td>
                </tr>`;
                subs.forEach(sub => {
                    html += `<tr>
                        <td class="col-question" style="padding-left:16px;">(${sub.sub_number}) ${this.cleanHTML(sub.question_text)}</td>
                        <td class="col-cok">${sub.co}-${sub.k_level}</td>
                        <td class="col-marks">${sub.marks}</td>
                    </tr>`;
                });
            } else {
                html += this.renderQuestionRow(q.question_number, '', q, false);
            }
        });

        html += `</tbody></table>`;
        return html;
    },

    renderQuestionRow(num, prefix, q, isOR) {
        const qText = this.cleanHTML(q.question_text);
        const displayNum = prefix ? `${num}${prefix}` : num;
        const imgHtml = q.image_path ? this.renderImageInTable(q) : '';

        // MCQ rendering
        let mcqHtml = '';
        if (q.question_type === 'mcq' && q.mcq_options) {
            mcqHtml = '<br>' + q.mcq_options.map(opt =>
                `(${opt.label}) ${opt.text || '___'}`
            ).join('&nbsp;&nbsp;&nbsp;&nbsp;');
        }

        return `<tr>
            <td class="col-qno">${displayNum}</td>
            <td class="col-question">${qText}${mcqHtml}${imgHtml}</td>
            <td class="col-cok">${q.co || 'CO1'}-${q.k_level || 'K1'}</td>
            <td class="col-marks">${q.marks}</td>
        </tr>`;
    },

    renderImageInTable(q) {
        if (!q.image_path) return '';
        const maxW = q.image_size === 'small' ? '120px' : q.image_size === 'large' ? '300px' : '200px';
        return `<br><div style="text-align:${q.image_alignment || 'center'}; margin-top:4px;">
            <img src="${q.image_path}" style="max-width:${maxW}; max-height:200px;">
        </div>`;
    },

    renderCompetencyAnalysis(competency) {
        if (!competency || !competency.data) return '';
        let html = `
            <div class="analysis-section">
                <div class="analysis-title">Competency Level Analysis</div>
                <table class="analysis-table-pdf">
                    <thead>
                        <tr>
                            <th>Level</th>
                            <th>Bloom's Taxonomy</th>
                            <th>Question No.</th>
                            <th>Marks</th>
                            <th>Contribution %</th>
                        </tr>
                    </thead>
                    <tbody>`;

        Object.values(competency.data).forEach(entry => {
            if (entry.marks > 0) {
                html += `<tr>
                    <td>${entry.level}</td>
                    <td>${entry.taxonomy}</td>
                    <td>${(entry.questions || []).join(', ')}</td>
                    <td>${entry.marks}</td>
                    <td>${entry.percentage}%</td>
                </tr>`;
            }
        });

        html += `<tr style="font-weight:bold; background:#f0f0f0;">
            <td colspan="3">Total</td>
            <td>${competency.totalMarks || 0}</td>
            <td>100%</td>
        </tr></tbody></table></div>`;

        return html;
    },

    renderCOAnalysis(coAnalysis) {
        if (!coAnalysis || !coAnalysis.data) return '';
        let html = `
            <div class="analysis-section">
                <div class="analysis-title">Course Outcome Marks Contribution</div>
                <table class="analysis-table-pdf">
                    <thead>
                        <tr>
                            <th>Course Outcome</th>
                            <th>Marks</th>
                            <th>Contribution %</th>
                        </tr>
                    </thead>
                    <tbody>`;

        Object.values(coAnalysis.data).forEach(entry => {
            html += `<tr>
                <td>${entry.co}</td>
                <td>${entry.marks}</td>
                <td>${entry.percentage}%</td>
            </tr>`;
        });

        html += `<tr style="font-weight:bold; background:#f0f0f0;">
            <td>Total</td>
            <td>${coAnalysis.totalMarks || 0}</td>
            <td>100%</td>
        </tr></tbody></table></div>`;

        return html;
    },

    renderFooter(template) {
        const cols = template.pdfLayout.footer.columns;
        return `
            <div class="footer-section">
                ${cols.map(col => `
                    <div class="footer-col">
                        <div class="line"></div>
                        <div>${col.label}</div>
                    </div>`).join('')}
            </div>`;
    },

    cleanHTML(html) {
        if (!html) return '';
        return html
            .replace(/<p>/g, '')
            .replace(/<\/p>/g, '<br>')
            .replace(/<br\s*\/?>\s*$/, '');
    }
};

window.addEventListener('afterprint', () => {
    const printArea = document.getElementById('printArea');
    if (printArea) printArea.innerHTML = '';
});

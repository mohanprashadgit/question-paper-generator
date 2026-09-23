/**
 * Analysis Engine
 * Automatic CO & K-Level analysis computation
 * Grace College Question Paper Generator
 */
const Analysis = {
    K_LEVELS: {
        K1: 'Remember',
        K2: 'Understand',
        K3: 'Apply',
        K4: 'Analyze',
        K5: 'Evaluate',
        K6: 'Create'
    },

    coChart: null,
    kLevelChart: null,

    /**
     * Compute full analysis from questions
     */
    compute(questions) {
        const allQuestions = this.flattenQuestions(questions);
        const competency = this.computeCompetency(allQuestions);
        const coAnalysis = this.computeCO(allQuestions);
        return { competency, coAnalysis, allQuestions };
    },

    /**
     * Flatten questions including OR/sub children for analysis
     * For OR questions: use (a) option for analysis marks calculation
     */
    flattenQuestions(questions) {
        const flat = [];
        (questions || []).forEach(q => {
            if (!q.children || q.children.length === 0) {
                flat.push(q);
            } else {
                const orChildren = q.children.filter(c => c.or_group);
                const subChildren = q.children.filter(c => c.sub_number);

                if (orChildren.length > 0) {
                    // Add all OR options for mapping, but mark for analysis
                    orChildren.forEach(child => {
                        flat.push({
                            ...child,
                            question_number: q.question_number,
                            _isOrOption: true,
                            _analyzeMarks: child.or_group === 'a' // Only count (a) for total
                        });
                    });
                } else if (subChildren.length > 0) {
                    subChildren.forEach(child => {
                        flat.push({
                            ...child,
                            question_number: q.question_number,
                            _isSubQuestion: true,
                            _analyzeMarks: true
                        });
                    });
                } else {
                    flat.push(q);
                }
            }
        });
        return flat;
    },

    /**
     * Compute Competency Level Analysis (K-Level distribution)
     */
    computeCompetency(questions) {
        const result = {};

        Object.keys(this.K_LEVELS).forEach(k => {
            result[k] = {
                level: k,
                taxonomy: this.K_LEVELS[k],
                questions: [],
                marks: 0
            };
        });

        let totalAnalysisMarks = 0;

        questions.forEach(q => {
            const kl = q.k_level || 'K1';
            const marks = parseInt(q.marks) || 0;
            const qLabel = this.getQLabel(q);

            if (result[kl]) {
                // Avoid duplicate question labels
                if (!result[kl].questions.includes(qLabel)) {
                    result[kl].questions.push(qLabel);
                }

                // For OR questions, only count (a) option marks toward total
                if (q._isOrOption) {
                    if (q._analyzeMarks) {
                        result[kl].marks += marks;
                        totalAnalysisMarks += marks;
                    }
                } else {
                    result[kl].marks += marks;
                    totalAnalysisMarks += marks;
                }
            }
        });

        // Calculate percentages
        Object.values(result).forEach(entry => {
            entry.percentage = totalAnalysisMarks > 0
                ? Math.round((entry.marks / totalAnalysisMarks) * 100 * 10) / 10
                : 0;
        });

        return { data: result, totalMarks: totalAnalysisMarks };
    },

    /**
     * Compute CO Analysis
     */
    computeCO(questions) {
        const result = {};
        let totalAnalysisMarks = 0;

        questions.forEach(q => {
            const co = q.co || 'CO1';
            const marks = parseInt(q.marks) || 0;

            if (!result[co]) {
                result[co] = { co, marks: 0 };
            }

            if (q._isOrOption) {
                if (q._analyzeMarks) {
                    result[co].marks += marks;
                    totalAnalysisMarks += marks;
                }
            } else {
                result[co].marks += marks;
                totalAnalysisMarks += marks;
            }
        });

        Object.values(result).forEach(entry => {
            entry.percentage = totalAnalysisMarks > 0
                ? Math.round((entry.marks / totalAnalysisMarks) * 100 * 10) / 10
                : 0;
        });

        // Sort by CO number
        const sorted = {};
        Object.keys(result).sort((a, b) => {
            const na = parseInt(a.replace('CO', ''));
            const nb = parseInt(b.replace('CO', ''));
            return na - nb;
        }).forEach(k => { sorted[k] = result[k]; });

        return { data: sorted, totalMarks: totalAnalysisMarks };
    },

    /**
     * Get question label for analysis
     */
    getQLabel(q) {
        let label = String(q.question_number);
        if (q.or_group) label += `(${q.or_group})`;
        if (q.sub_number) label += `(${q.sub_number})`;
        return label;
    },

    /**
     * Render analysis page
     */
    render(paperData) {
        const questions = paperData.questions || [];
        const regulation = paperData.regulation || '21';
        const template = (typeof App !== 'undefined' && App.getTemplate) ? App.getTemplate(regulation) : (regulation === '25' ? REGULATION_25 : REGULATION_21);
        const analysis = this.compute(questions);

        this.renderStats(analysis, template);
        this.renderCompetencyTable(analysis.competency);
        this.renderCOTable(analysis.coAnalysis);
        this.renderCharts(analysis);
        this.renderAnalysisValidation(paperData, regulation);
    },

    renderStats(analysis, template) {
        const container = document.getElementById('analysisStats');
        if (!container) return;

        const totalQ = analysis.allQuestions.length;
        const coCount = Object.keys(analysis.coAnalysis.data).length;
        const kCount = Object.values(analysis.competency.data).filter(k => k.marks > 0).length;

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <div class="stat-info"><h4>${analysis.competency.totalMarks}</h4><p>Total Marks</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon gold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/></svg>
                </div>
                <div class="stat-info"><h4>${totalQ}</h4><p>Total Questions</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div class="stat-info"><h4>${coCount}</h4><p>COs Covered</p></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="stat-info"><h4>${kCount}</h4><p>K-Levels Used</p></div>
            </div>`;
    },

    renderCompetencyTable(competency) {
        const tbody = document.getElementById('competencyTableBody');
        const tfoot = document.getElementById('competencyTableFoot');
        if (!tbody) return;

        let html = '';
        Object.values(competency.data).forEach(entry => {
            html += `
                <tr>
                    <td><strong>${entry.level}</strong></td>
                    <td>${entry.taxonomy}</td>
                    <td>${entry.questions.length > 0 ? entry.questions.join(', ') : '-'}</td>
                    <td>${entry.marks}</td>
                    <td>${entry.percentage}%</td>
                </tr>`;
        });
        tbody.innerHTML = html;

        tfoot.innerHTML = `
            <tr>
                <td colspan="3"><strong>Total</strong></td>
                <td><strong>${competency.totalMarks}</strong></td>
                <td><strong>100%</strong></td>
            </tr>`;
    },

    renderCOTable(coAnalysis) {
        const tbody = document.getElementById('coTableBody');
        const tfoot = document.getElementById('coTableFoot');
        if (!tbody) return;

        let html = '';
        Object.values(coAnalysis.data).forEach(entry => {
            html += `
                <tr>
                    <td><strong>${entry.co}</strong></td>
                    <td>${entry.marks}</td>
                    <td>${entry.percentage}%</td>
                </tr>`;
        });
        tbody.innerHTML = html;

        tfoot.innerHTML = `
            <tr>
                <td><strong>Total</strong></td>
                <td><strong>${coAnalysis.totalMarks}</strong></td>
                <td><strong>100%</strong></td>
            </tr>`;
    },

    renderCharts(analysis) {
        // CO Donut Chart
        const coCtx = document.getElementById('coChart');
        if (coCtx) {
            if (this.coChart) this.coChart.destroy();

            const coData = Object.values(analysis.coAnalysis.data);
            this.coChart = new Chart(coCtx, {
                type: 'doughnut',
                data: {
                    labels: coData.map(c => c.co),
                    datasets: [{
                        data: coData.map(c => c.marks),
                        backgroundColor: [
                            '#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE',
                            '#D4A017', '#F5D060', '#059669', '#2563EB'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 16, font: { family: 'Inter' } } }
                    }
                }
            });
        }

        // K-Level Bar Chart
        const klCtx = document.getElementById('kLevelChart');
        if (klCtx) {
            if (this.kLevelChart) this.kLevelChart.destroy();

            const kData = Object.values(analysis.competency.data);
            this.kLevelChart = new Chart(klCtx, {
                type: 'bar',
                data: {
                    labels: kData.map(k => `${k.level} - ${k.taxonomy}`),
                    datasets: [{
                        label: 'Marks',
                        data: kData.map(k => k.marks),
                        backgroundColor: [
                            '#7C3AED', '#A78BFA', '#D4A017',
                            '#059669', '#2563EB', '#DC2626'
                        ],
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#F0EDF5' } },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    },

    renderAnalysisValidation(paperData, regulation) {
        const container = document.getElementById('analysisValidation');
        if (!container) return;

        const validation = Validation.validate(paperData, regulation);
        const questions = paperData.questions || [];

        const checks = [
            { label: 'All questions mapped', ok: questions.every(q => q.co && q.k_level) },
            { label: 'Marks valid', ok: validation.errors.filter(e => e.field?.includes('marks')).length === 0 },
            { label: 'CO assigned to all', ok: questions.every(q => q.co) },
            { label: 'Unit assigned to all', ok: questions.every(q => q.unit) },
            { label: 'K-Level assigned to all', ok: questions.every(q => q.k_level) },
            { label: 'Total marks match regulation', ok: validation.errors.filter(e => e.field === 'total_marks').length === 0 }
        ];

        container.innerHTML = checks.map(c => `
            <div style="display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid var(--border-light);">
                <span style="font-size:18px;">${c.ok ? '✅' : '❌'}</span>
                <span style="font-size:14px; color: ${c.ok ? 'var(--success)' : 'var(--error)'}">${c.label}</span>
            </div>`).join('');
    }
};

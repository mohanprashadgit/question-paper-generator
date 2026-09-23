/**
 * Storage Module
 * Handles data persistence via localStorage (with API fallback)
 * Grace College Question Paper Generator
 */
const Storage = {
    DB_PREFIX: 'gcqp_',

    // =============================================
    // LocalStorage CRUD
    // =============================================
    save(key, data) {
        try {
            localStorage.setItem(this.DB_PREFIX + key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    },

    load(key) {
        try {
            const data = localStorage.getItem(this.DB_PREFIX + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage load error:', e);
            return null;
        }
    },

    remove(key) {
        localStorage.removeItem(this.DB_PREFIX + key);
    },

    // =============================================
    // Papers CRUD
    // =============================================
    getAllPapers() {
        return this.load('papers') || [];
    },

    savePaper(paper) {
        const papers = this.getAllPapers();
        const existingIdx = papers.findIndex(p => p.id === paper.id);
        paper.updated_at = new Date().toISOString();

        if (existingIdx >= 0) {
            papers[existingIdx] = paper;
        } else {
            paper.id = paper.id || 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            paper.created_at = paper.created_at || new Date().toISOString();
            papers.unshift(paper);
        }

        this.save('papers', papers);

        // Asynchronously sync to MySQL (Local or Cloud)
        this.apiCall('save_paper', 'POST', paper).then(res => {
            if (res && res.success) {
                console.log(`✅ Paper synced to database: ${res.db_name || ''} (${res.env || ''})`);
            }
        }).catch(err => {
            console.log('Database sync offline/pending:', err);
        });

        return paper;
    },

    getPaper(id) {
        return this.getAllPapers().find(p => p.id === id) || null;
    },

    deletePaper(id) {
        const papers = this.getAllPapers().filter(p => p.id !== id);
        this.save('papers', papers);

        // Asynchronously sync delete to MySQL
        this.apiCall(`delete_paper&id=${encodeURIComponent(id)}`, 'POST').catch(() => {});
    },

    duplicatePaper(id) {
        const paper = this.getPaper(id);
        if (!paper) return null;

        const newPaper = JSON.parse(JSON.stringify(paper));
        newPaper.id = 'paper_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        newPaper.course_name = (newPaper.course_name || '') + ' (Copy)';
        newPaper.status = 'draft';
        newPaper.created_at = new Date().toISOString();
        newPaper.updated_at = new Date().toISOString();

        const papers = this.getAllPapers();
        papers.unshift(newPaper);
        this.save('papers', papers);
        return newPaper;
    },

    // =============================================
    // Question Bank
    // =============================================
    getQuestionBank() {
        return this.load('question_bank') || [];
    },

    addToBank(question) {
        const bank = this.getQuestionBank();
        question.id = question.id || 'qb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        question.created_at = new Date().toISOString();
        bank.unshift(question);
        this.save('question_bank', bank);
        return question;
    },

    removeFromBank(id) {
        const bank = this.getQuestionBank().filter(q => q.id !== id);
        this.save('question_bank', bank);
    },

    // =============================================
    // Settings
    // =============================================
    getSettings() {
        return this.load('settings') || {
            default_regulation: '21',
            default_degree: 'B.Tech',
            default_programme: 'Artificial Intelligence and Data Science',
            co_count: 6,
            college_name: 'GRACE COLLEGE OF ENGINEERING',
            college_subtitle: '(Approved by AICTE, New Delhi & Affiliated to ANNA UNIVERSITY, Chennai)',
            college_location: 'Mullakkadu, THOOTHUKUDI – 05'
        };
    },

    saveSettings(settings) {
        this.save('settings', settings);
    },

    // =============================================
    // Current Working Paper (auto-save)
    // =============================================
    saveCurrentPaper(data) {
        this.save('current_paper', data);
    },

    loadCurrentPaper() {
        return this.load('current_paper');
    },

    clearCurrentPaper() {
        this.remove('current_paper');
    },

    // =============================================
    // Custom Regulations CRUD
    // =============================================
    getCustomRegulations() {
        return this.load('custom_regulations') || [];
    },

    getCustomRegulation(code) {
        const list = this.getCustomRegulations();
        return list.find(r => String(r.code) === String(code)) || null;
    },

    saveCustomRegulation(regData) {
        if (!regData || !regData.code) return false;
        const list = this.getCustomRegulations();
        const existingIdx = list.findIndex(r => String(r.code) === String(regData.code));
        regData.updated_at = new Date().toISOString();

        if (existingIdx >= 0) {
            list[existingIdx] = regData;
        } else {
            regData.created_at = new Date().toISOString();
            list.push(regData);
        }

        this.save('custom_regulations', list);
        return true;
    },

    deleteCustomRegulation(code) {
        const list = this.getCustomRegulations();
        const filtered = list.filter(r => String(r.code) !== String(code));
        this.save('custom_regulations', filtered);
        return true;
    },

    // =============================================
    // Export/Import
    // =============================================
    exportAllData() {
        const data = {
            papers: this.getAllPapers(),
            custom_regulations: this.getCustomRegulations(),
            question_bank: this.getQuestionBank(),
            settings: this.getSettings(),
            exported_at: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grace_qpg_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        App.showToast('Data exported successfully!', 'success');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.papers) this.save('papers', data.papers);
                if (data.custom_regulations) this.save('custom_regulations', data.custom_regulations);
                if (data.question_bank) this.save('question_bank', data.question_bank);
                if (data.settings) this.save('settings', data.settings);
                App.showToast('Data imported successfully!', 'success');
                App.refreshCurrentPage();
            } catch (err) {
                App.showToast('Invalid file format!', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    clearAllData() {
        if (!confirm('⚠️ This will delete ALL papers, question bank entries, and settings. Are you sure?')) return;
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.DB_PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
        App.showToast('All data cleared', 'warning');
        App.refreshCurrentPage();
    },

    // =============================================
    // Saved Papers UI & Bulk Actions
    // =============================================
    selectedPaperIds: new Set(),
    lastFilteredPapers: [],

    filterPapers() {
        const search = (document.getElementById('savedSearchInput')?.value || '').trim().toLowerCase();
        const dept = document.getElementById('savedFilterDept')?.value || '';
        const year = document.getElementById('savedFilterYear')?.value || '';
        const reg = document.getElementById('savedFilterReg')?.value || '';
        const status = document.getElementById('savedFilterStatus')?.value || '';

        let papers = this.getAllPapers();

        // 1. Department / Programme filter
        if (dept) {
            papers = papers.filter(p => p.programme === dept);
        }

        // 2. Year filter
        if (year) {
            papers = papers.filter(p => p.year === year);
        }

        // 3. Regulation filter
        if (reg) {
            papers = papers.filter(p => p.regulation === reg);
        }

        // 4. Status filter
        if (status) {
            papers = papers.filter(p => p.status === status);
        }

        // 5. Fast Multi-field Search filter (code, name, dept, exam, year, sem, reg)
        if (search) {
            papers = papers.filter(p => {
                const code = (p.course_code || '').toLowerCase();
                const name = (p.course_name || '').toLowerCase();
                const prog = (p.programme || '').toLowerCase();
                const exam = (p.exam_type || '').toLowerCase();
                const pYear = (p.year || '').toLowerCase();
                const pSem = (p.semester || '').toLowerCase();
                const pReg = (p.regulation || '').toLowerCase() + ' ' + (p.regulation || '') + ' reg';
                return code.includes(search) ||
                       name.includes(search) ||
                       prog.includes(search) ||
                       exam.includes(search) ||
                       pYear.includes(search) ||
                       pSem.includes(search) ||
                       pReg.includes(search);
            });
        }

        this.lastFilteredPapers = papers;

        // Update count badge
        const countBadge = document.getElementById('savedPapersCountBadge');
        const allPapersCount = this.getAllPapers().length;
        if (countBadge) {
            if (papers.length === allPapersCount) {
                countBadge.textContent = `${papers.length} paper${papers.length !== 1 ? 's' : ''}`;
            } else {
                countBadge.textContent = `Showing ${papers.length} of ${allPapersCount} papers`;
            }
        }

        this.renderPapersList(papers);
        this.updateSelectionUI();
    },

    resetFilters() {
        const ids = ['savedSearchInput', 'savedFilterDept', 'savedFilterYear', 'savedFilterReg', 'savedFilterStatus'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.filterPapers();
    },

    toggleSelectAll(checked) {
        if (checked) {
            this.lastFilteredPapers.forEach(p => this.selectedPaperIds.add(p.id));
        } else {
            this.selectedPaperIds.clear();
        }
        this.updateSelectionUI();
    },

    toggleSelectPaper(id, checked) {
        if (checked) {
            this.selectedPaperIds.add(id);
        } else {
            this.selectedPaperIds.delete(id);
        }
        this.updateSelectionUI();
    },

    getSelectedPaperIds() {
        return Array.from(this.selectedPaperIds);
    },

    updateSelectionUI() {
        document.querySelectorAll('.paper-select-chk').forEach(chk => {
            chk.checked = this.selectedPaperIds.has(chk.dataset.id);
        });

        const selectAllChk = document.getElementById('selectAllPapersChk');
        if (selectAllChk && this.lastFilteredPapers.length > 0) {
            const allSelected = this.lastFilteredPapers.every(p => this.selectedPaperIds.has(p.id));
            selectAllChk.checked = allSelected;
            selectAllChk.indeterminate = !allSelected && this.lastFilteredPapers.some(p => this.selectedPaperIds.has(p.id));
        }

        const count = this.selectedPaperIds.size;
        const deleteBtn = document.getElementById('bulkDeleteBtn');
        const countEl = document.getElementById('selectedCount');
        if (countEl) countEl.textContent = count;
        if (deleteBtn) deleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    },

    renderPapersList(papers) {
        const container = document.getElementById('savedPapersList');
        if (!papers || papers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    <h3>No papers found</h3>
                    <p>No question papers match your filters.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="papers-table">
                    <thead>
                        <tr>
                            <th style="width:36px; text-align:center;">
                                <input type="checkbox" id="selectAllPapersChk" onchange="Storage.toggleSelectAll(this.checked)" title="Select All">
                            </th>
                            <th>Course</th>
                            <th>Department</th>
                            <th>Year / Sem</th>
                            <th>Regulation</th>
                            <th>Exam</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${papers.map(p => {
                            const modified = p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : (p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}) : '-');
                            const isChecked = this.selectedPaperIds.has(p.id) ? 'checked' : '';
                            const deptShort = this.getShortDept(p.programme);
                            const yearSem = (p.year || p.semester) ? `Yr ${p.year || '-'}${p.semester ? ' / Sem ' + p.semester : ''}` : '-';

                            return `
                            <tr class="${isChecked ? 'row-selected' : ''}">
                                <td style="text-align:center;">
                                    <input type="checkbox" class="paper-select-chk" data-id="${p.id}" ${isChecked} onchange="Storage.toggleSelectPaper('${p.id}', this.checked)">
                                </td>
                                <td>
                                    <div style="font-weight:700; color:var(--text); font-size:14px;">${p.course_code || 'No Code'}</div>
                                    <div style="color:var(--text-muted); font-size:12px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${p.course_name || ''}">${p.course_name || 'Untitled Paper'}</div>
                                </td>
                                <td>
                                    <span class="dept-badge" title="${p.programme || ''}">${deptShort}</span>
                                </td>
                                <td><span style="font-size:12px; color:var(--text); font-weight:500;">${yearSem}</span></td>
                                <td><span class="qbank-tag">${p.regulation} Reg</span></td>
                                <td><span style="font-size:12px; color:var(--text); font-weight:500;">${p.exam_type || '-'}</span></td>
                                <td><span class="status-badge ${p.status}">${p.status}</span></td>
                                <td>
                                    <div style="font-size:12px; font-weight:500; color:var(--text);">${modified}</div>
                                </td>
                                <td>
                                    <div class="table-actions-group">
                                        <button class="table-action-btn btn-edit" onclick="App.loadPaper('${p.id}')" title="Edit Question Paper">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button class="table-action-btn btn-pdf" onclick="Storage.exportSinglePDF('${p.id}')" title="Export PDF">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        </button>
                                        <button class="table-action-btn btn-print" onclick="Storage.printSinglePaper('${p.id}')" title="Direct Print">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                        </button>
                                        <button class="table-action-btn btn-copy" onclick="Storage.duplicatePaperAndRefresh('${p.id}')" title="Duplicate Paper">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                        </button>
                                        <button class="table-action-btn btn-delete" onclick="Storage.deletePaperAndRefresh('${p.id}')" title="Delete Paper">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    getShortDept(prog) {
        if (!prog) return '-';
        const map = {
            'Artificial Intelligence and Data Science': 'AI&DS',
            'Computer Science and Engineering': 'CSE',
            'Electronics and Communication Engineering': 'ECE',
            'Electrical and Electronics Engineering': 'EEE',
            'Civil Engineering': 'CE',
            'Mechanical Engineering': 'ME'
        };
        return map[prog] || prog;
    },

    exportSinglePDF(id) {
        const paper = this.getPaper(id);
        if (!paper) {
            App.showToast('Paper not found!', 'error');
            return;
        }
        PDFGenerator.generatePDF(paper);
    },

    printSinglePaper(id) {
        const paper = this.getPaper(id);
        if (!paper) {
            App.showToast('Paper not found!', 'error');
            return;
        }
        App.showToast(`Preparing print for ${paper.course_code || 'paper'}...`, 'info');
        Preview.print(paper);
    },

    duplicatePaperAndRefresh(id) {
        this.duplicatePaper(id);
        App.showToast('Paper duplicated!', 'success');
        this.filterPapers();
    },

    deletePaperAndRefresh(id) {
        if (!confirm('Delete this paper?')) return;
        this.deletePaper(id);
        this.selectedPaperIds.delete(id);
        App.showToast('Paper deleted', 'warning');
        this.filterPapers();
        App.updateDashboardStats();
    },

    bulkPrint() {
        const selectedIds = this.getSelectedPaperIds();
        const papersToPrint = selectedIds.length > 0 
            ? selectedIds.map(id => this.getPaper(id)).filter(Boolean)
            : this.lastFilteredPapers;

        if (!papersToPrint || papersToPrint.length === 0) {
            App.showToast('No papers found to print!', 'warning');
            return;
        }

        App.showToast(`Preparing print for ${papersToPrint.length} paper(s)...`, 'info');
        Preview.print(papersToPrint);
    },

    async bulkExportPDF() {
        const selectedIds = this.getSelectedPaperIds();
        const papersToExport = selectedIds.length > 0
            ? selectedIds.map(id => this.getPaper(id)).filter(Boolean)
            : this.lastFilteredPapers;

        if (papersToExport.length === 0) {
            App.showToast('No papers found to export!', 'warning');
            return;
        }

        App.showToast(`Exporting ${papersToExport.length} paper(s)...`, 'info');
        for (let i = 0; i < papersToExport.length; i++) {
            const paper = papersToExport[i];
            await PDFGenerator.generatePDF(paper);
            if (i < papersToExport.length - 1) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
    },

    bulkDelete() {
        const selectedIds = this.getSelectedPaperIds();
        if (selectedIds.length === 0) {
            App.showToast('No papers selected!', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected paper(s)?`)) return;

        let papers = this.getAllPapers();
        papers = papers.filter(p => !selectedIds.includes(p.id));
        this.save('papers', papers);
        
        selectedIds.forEach(id => {
            this.apiCall('delete_paper&id=' + encodeURIComponent(id), 'DELETE').catch(() => {});
        });

        this.selectedPaperIds.clear();
        App.showToast(`${selectedIds.length} paper(s) deleted`, 'warning');
        this.filterPapers();
        App.updateDashboardStats();
    },

    // =============================================
    // API Communication & Database Sync
    // =============================================
    async apiCall(action, method = 'GET', data = null) {
        try {
            const url = action.startsWith('api.php') ? action : `api.php?action=${action}`;
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(url, options);
            return await response.json();
        } catch (e) {
            console.log('API not available, using localStorage fallback');
            return null;
        }
    },

    async syncWithDatabase() {
        try {
            const res = await this.apiCall('get_papers', 'GET');
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                const localPapers = this.getAllPapers();
                const paperMap = new Map();

                // Load existing local papers first
                localPapers.forEach(p => { if (p && p.id) paperMap.set(p.id, p); });

                // Merge database papers
                res.data.forEach(dbP => {
                    if (!dbP || !dbP.id) return;
                    const localP = paperMap.get(dbP.id);
                    if (!localP || !localP.updated_at || (dbP.updated_at && new Date(dbP.updated_at) >= new Date(localP.updated_at))) {
                        paperMap.set(dbP.id, dbP);
                    }
                });

                const merged = Array.from(paperMap.values()).sort((a, b) => {
                    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
                });

                this.save('papers', merged);
                return merged;
            }
        } catch (e) {
            console.log('Database sync error, using local data:', e);
        }
        return this.getAllPapers();
    }
};
